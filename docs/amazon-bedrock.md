# Amazon Bedrock provider

Presenton can use **Amazon Bedrock** as the text LLM provider for presentation generation, editing, and chat. Configure Bedrock in the app UI (**Settings → Text provider**) or with environment variables / `userConfig.json` (Docker and desktop).

The backend sends your configured **Model** value to the Bedrock **Converse** API as `modelId`. That means you can use:

- Standard on-demand **model IDs** (for example `us.anthropic.claude-3-5-haiku-20241022-v1:0`)
- **Inference profile ARNs** (required for some newer models such as Claude Sonnet 4.6)

Region and credentials must match the model or profile you choose.

---

## Required configuration

| Field (UI) | Environment variable | Description |
| --- | --- | --- |
| **Provider** | `LLM=bedrock` | Select **Amazon Bedrock**. |
| **Region** | `BEDROCK_REGION` | AWS region for Bedrock (default: `us-east-1`). Must match where the model or inference profile is available. |
| **Model** | `BEDROCK_MODEL` | Model ID or inference profile ARN (see below). |
| **AWS Access Key ID** | `BEDROCK_AWS_ACCESS_KEY_ID` | IAM access key with Bedrock invoke permissions. |
| **AWS Secret Access Key** | `BEDROCK_AWS_SECRET_ACCESS_KEY` | Secret for the access key above. |

### Authentication

Use **one** of these patterns:

1. **AWS access key pair** (most common): Access Key ID + Secret Access Key (required fields above).
2. **Bedrock API key** (optional UI field): `BEDROCK_API_KEY` — if set, you do not need the access key pair.

Do not mix Bedrock API key auth with explicit AWS access key fields; the client accepts one method only.

---

## Optional (advanced) fields

Under **Advanced settings** in the Bedrock form (or via env):

| Field (UI) | Environment variable | When to use |
| --- | --- | --- |
| **AWS Session Token** | `BEDROCK_AWS_SESSION_TOKEN` | Temporary credentials (STS, assumed role, SSO session). |
| **AWS Profile Name** | `BEDROCK_PROFILE_NAME` | Use a named profile from `~/.aws/credentials` instead of inline keys (desktop/local dev). |

These are optional. Most Docker and server deployments only need region, model, and access key + secret.

---

## Model ID vs inference profile ARN

Many Bedrock models support **on-demand** invocation with a model ID like:

```text
us.anthropic.claude-3-5-haiku-20241022-v1:0
```

Some **newer** models (for example **Claude Sonnet 4.6**) do **not** support on-demand throughput with a plain model ID. For those you must use an **inference profile** ARN in the **Model** field.

In the AWS console: **Bedrock → Inference profiles** (or cross-region inference profiles), copy the full ARN, and paste it into Presenton’s **Model** field unchanged.

Presenton passes that string directly to Converse as `modelId`, so both formats work as long as AWS accepts them for your account and region.

---

## Common error: on-demand throughput not supported

You may see an error similar to:

```text
Invocation of model ID anthropic.claude-sonnet-4-6 with on-demand throughput isn't supported.
A model ID is currently required in model invocation requests for on-demand throughput.
A foundation model ARN or inference profile ARN is currently required in model invocation requests.
```

**What it means**

- The model ID you entered is valid in Bedrock, but that model **only** supports invocation through a **foundation model ARN** or **inference profile ARN**, not classic on-demand model IDs.
- This often applies to newer Anthropic models and **cross-region inference** setups.

**What to do**

1. Open **Amazon Bedrock** in the same **region** as `BEDROCK_REGION`.
2. Find the **inference profile** for the model (for example `us.anthropic.claude-sonnet-4-6`).
3. Copy the full **inference profile ARN**.
4. Paste the ARN into Presenton’s **Model** field (not the short model ID).
5. Ensure IAM allows `bedrock:InvokeModel` / Converse on that profile in that region.

---

## Example: working configuration (Claude Sonnet 4.6)

Use an inference profile ARN in **Model**, with region **us-east-1**:

| Setting | Value |
| --- | --- |
| Provider | `bedrock` |
| Region | `us-east-1` |
| Model | `arn:aws:bedrock:us-east-1:471112542209:inference-profile/us.anthropic.claude-sonnet-4-6` |
| AWS Access Key ID | Your IAM user or role access key |
| AWS Secret Access Key | Matching secret |

Replace `471112542209` with **your** AWS account ID. The ARN must come from **your** Bedrock console for the profile you enabled.

### Docker

```bash
docker run -it --name presenton -p 5000:80 \
  -e LLM="bedrock" \
  -e BEDROCK_REGION="us-east-1" \
  -e BEDROCK_AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY_ID" \
  -e BEDROCK_AWS_SECRET_ACCESS_KEY="YOUR_SECRET_ACCESS_KEY" \
  -e BEDROCK_MODEL="arn:aws:bedrock:us-east-1:471112542209:inference-profile/us.anthropic.claude-sonnet-4-6" \
  -e IMAGE_PROVIDER="pexels" \
  -e PEXELS_API_KEY="YOUR_PEXELS_KEY" \
  -e CAN_CHANGE_KEYS="false" \
  -v "./app_data:/app_data" \
  ghcr.io/presenton/presenton:latest
```

### On-demand model example (Haiku)

For models that support on-demand IDs:

```bash
-e BEDROCK_MODEL="us.anthropic.claude-3-5-haiku-20241022-v1:0"
```

---

## IAM permissions

The IAM principal (user or role) behind your keys needs permission to call Bedrock in the configured region, for example:

- `bedrock:InvokeModel`
- `bedrock:InvokeModelWithResponseStream`

Scope policies to the model IDs or inference profile ARNs you use. If you use inference profiles, include the profile ARN (or a wildcard your org allows) in the resource list.

Enable model access in the Bedrock console (**Model access**) for the foundation models tied to your profile.

---

## Troubleshooting

### Invalid model identifier

- **Symptom:** `ValidationException`, unknown model, or model not found.
- **Checks:**
  - **Model** matches exactly what Bedrock shows (ID or full ARN, no extra spaces).
  - For Sonnet 4.6–class models, use an **inference profile ARN**, not only `anthropic.claude-…` without the profile path.
  - Model access is **enabled** for your account in that region.

### Missing Bedrock permissions

- **Symptom:** `AccessDeniedException`, not authorized to perform `bedrock:InvokeModel`.
- **Checks:**
  - IAM policy allows invoke on the model or inference profile.
  - Keys belong to the intended account; no typo in access key or secret.
  - If using `BEDROCK_PROFILE_NAME`, the profile’s role has Bedrock permissions.

### Region mismatch

- **Symptom:** Model not found, or profile ARN rejected.
- **Checks:**
  - `BEDROCK_REGION` is the region where the model/profile was created (for example `us-east-1` in the ARN path must match `BEDROCK_REGION`).
  - Cross-region inference profiles still use a home region in the ARN; configure Presenton’s region to match AWS guidance for that profile.

### Unsupported on-demand invocation

- **Symptom:** Error text mentions *on-demand throughput isn’t supported* or requires *inference profile ARN*.
- **Fix:** Switch **Model** from a plain model ID to the **inference profile ARN** (see [Common error](#common-error-on-demand-throughput-not-supported) above).

### Auth configuration errors at startup

- **Symptom:** “Bedrock auth is incomplete” or “Provide either api_key or AWS credentials”.
- **Fix:** Set `BEDROCK_API_KEY`, **or** both `BEDROCK_AWS_ACCESS_KEY_ID` and `BEDROCK_AWS_SECRET_ACCESS_KEY`. Do not leave all three empty.

---

## Environment variable reference

| Variable | Required | Notes |
| --- | --- | --- |
| `LLM` | Yes | Must be `bedrock`. |
| `BEDROCK_REGION` | Recommended | Default `us-east-1` if unset. |
| `BEDROCK_MODEL` | Yes | Model ID or inference profile ARN. |
| `BEDROCK_AWS_ACCESS_KEY_ID` | If not using API key | Pair with secret. |
| `BEDROCK_AWS_SECRET_ACCESS_KEY` | If not using API key | Pair with access key ID. |
| `BEDROCK_API_KEY` | Optional | Alternative to access key pair. |
| `BEDROCK_AWS_SESSION_TOKEN` | Optional | Temporary credentials. |
| `BEDROCK_PROFILE_NAME` | Optional | Named AWS profile. |

See also the [Deployment configurations](../README.md#️-deployment-configurations) section in the main README.
