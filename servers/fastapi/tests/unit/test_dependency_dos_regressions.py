import subprocess
import sys
import textwrap
import tracemalloc

import pytest


@pytest.mark.parametrize("segment", [0, 1, 2])
def test_jws_rejects_oversized_segments_without_copying_them(segment):
    from joserfc import jws
    from joserfc.errors import ExceededSizeError
    from joserfc.jwk import OctKey

    key = OctKey.import_key(b"presenton-security-control-key-32-bytes")
    signed = jws.serialize_compact({"alg": "HS256"}, b"control", key)
    assert jws.deserialize_compact(signed, key).payload == b"control"
    segments = [b"e30", b"Y29udHJvbA", b"AAAA"]
    segments[segment] = b"A" * (8 * 1024 * 1024)
    token = b".".join(segments)
    # Allocate the attacker input before tracing: the guard must reject it
    # without allocating another input-sized copy during parsing.
    tracemalloc.start()
    try:
        with pytest.raises(ExceededSizeError):
            jws.deserialize_compact(token, key)
        _, peak = tracemalloc.get_traced_memory()
    finally:
        tracemalloc.stop()
    assert peak < 1024 * 1024


def test_jwe_caps_recipient_work_in_both_verification_modes():
    from joserfc import jwe
    from joserfc.errors import ExceededSizeError
    from joserfc.jwe import GeneralJSONEncryption, JWERegistry
    from joserfc.jwk import RSAKey

    private_key = RSAKey.generate_key(2048)
    public_key = RSAKey.import_key(private_key.as_dict(private=False))
    message = GeneralJSONEncryption({"enc": "A128GCM"}, b"private control")
    message.add_recipient({"alg": "RSA-OAEP"}, public_key)
    token = jwe.encrypt_json(message, None)
    for verify_all in (True, False):
        registry = JWERegistry(verify_all_recipients=verify_all)
        assert jwe.decrypt_json(token, private_key, registry=registry).plaintext == b"private control"
        for count in (17, 500):
            hostile = {**token, "recipients": token["recipients"] * count}
            with pytest.raises(ExceededSizeError):
                jwe.decrypt_json(hostile, private_key, registry=registry)


@pytest.mark.parametrize("codec", ["ber", "cer", "der"])
@pytest.mark.parametrize("kind", ["real", "bit-string", "octet-string", "colliding-tags"])
def test_asn1_decoders_bound_reassembly_work_and_preserve_values(codec, kind):
    _decode_probe(codec, kind)


@pytest.mark.parametrize("codec", ["ber", "cer"])
def test_asn1_indefinite_any_bounds_reassembly_work(codec):
    _decode_probe(codec, "any")


def _decode_probe(codec, kind):
    # Separate processes bound regressions without platform-specific signals.
    # Inputs cover REAL integer accumulation, BIT/OCTET STRING fragments,
    # indefinite ANY concatenation, and schemaless tag-hash collisions.
    code = r"""
        import importlib
        import sys
        from pyasn1.type import univ
        decoder = importlib.import_module('pyasn1.codec.' + sys.argv[1] + '.decoder')
        kind = sys.argv[2]
        def tlv(tag, body):
            size = len(body)
            length = size.to_bytes(max(1, (size.bit_length() + 7) // 8), 'big')
            return bytes([tag, 0x80 | len(length)]) + length + body
        if kind == 'real':
            size = 1_000_000
            value, rest = decoder.decode(tlv(9, b'\x80\x00' + b'\xff' * size))
            assert tuple(value) == (int.from_bytes(b'\xff' * size, 'big'), 2, 0)
        elif kind == 'bit-string':
            count = 400_000
            value, rest = decoder.decode(tlv(0x23, b'\x03\x02\x00\xa5' * count), asn1Spec=univ.BitString())
            assert value.asOctets() == b'\xa5' * count
        elif kind == 'octet-string':
            count = 800_000
            value, rest = decoder.decode(tlv(0x24, b'\x04\x02AB' * count), asn1Spec=univ.OctetString())
            assert value.asOctets() == b'AB' * count
        elif kind == 'any':
            count = 800_000
            wire = b'\x30\x80' + b'\x04\x01A' * count + b'\x00\x00'
            value, rest = decoder.decode(wire, asn1Spec=univ.Any())
            assert bytes(value) == wire[:-2]
        else:
            count = 25_000
            def tag(tag_id):
                groups = [tag_id & 0x7f]
                tag_id >>= 7
                while tag_id:
                    groups.append((tag_id & 0x7f) | 0x80)
                    tag_id >>= 7
                return b'\xbf' + bytes(reversed(groups))
            ids = [32 + i * sys.hash_info.modulus for i in range(count)]
            wire = tlv(0x30, b''.join(tag(i) + b'\x03\x04\x01A' for i in ids))
            value, rest = decoder.decode(wire)
            assert len(value) == count
            assert value[0].asOctets() == value[count - 1].asOctets() == b'A'
            assert value[count - 1].tagSet[-1].tagId == ids[-1]
        assert rest == b''
    """
    result = subprocess.run(
        [sys.executable, "-B", "-c", textwrap.dedent(code), codec, kind],
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert result.returncode == 0, result.stderr
