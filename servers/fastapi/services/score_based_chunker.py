import asyncio

from models.document_chunk import DocumentChunk


class ScoreBasedChunker:
    def extract_headings(self, text: str) -> list[str]:
        lines = text.split("\n")
        headings = []

        for line in lines:
            line = line.strip()
            if line.startswith("#"):
                headings.append(line)

        return headings

    def score_headings(self, headings: list[str]) -> list[float]:
        heading_scores = []
        last_heading_index = -1
        first_heading_found = False

        for i, heading in enumerate(headings):
            score = 0.0

            heading_level = len(heading) - len(heading.lstrip("#"))

            if heading_level <= 3:
                score += 10.0 - (heading_level - 1) * 2.0
            else:
                score += 4.0 - (heading_level - 4) * 0.5

            if not first_heading_found:
                score += 5.0
                first_heading_found = True

            if last_heading_index != -1:
                distance = i - last_heading_index
                distance_bonus = min(5.0, distance * 0.5)
                score += distance_bonus

            last_heading_index = i
            heading_scores.append(score)

        return heading_scores

    def get_chunks_from_headings(
        self,
        text: str,
        headings: list[str],
        heading_scores: list[float],
        top_k: int = 10,
    ) -> list[DocumentChunk]:
        if not heading_scores:
            heading_scores = self.score_headings(headings)

        chunks = []
        heading_indices = []

        for i, score in enumerate(heading_scores):
            if score > 0:
                heading_indices.append((i, score))

        if len(heading_indices) == 0:
            return chunks

        heading_indices.sort(key=lambda x: (-x[1], x[0]))

        if len(heading_indices) <= top_k:
            selected_indices = [idx for idx, _ in heading_indices]
            selected_indices.sort()
        else:
            score_groups = {}
            for idx, score in heading_indices:
                rounded_score = round(score)
                if rounded_score not in score_groups:
                    score_groups[rounded_score] = []
                score_groups[rounded_score].append(idx)

            sorted_groups = sorted(score_groups.items(), key=lambda x: x[0], reverse=True)

            selected_indices = []

            for _score, indices in sorted_groups:
                indices.sort()
                remaining_needed = top_k - len(selected_indices)

                if remaining_needed <= 0:
                    break

                if len(indices) <= remaining_needed:
                    selected_indices.extend(indices)
                else:
                    if remaining_needed == 1:
                        mid_idx = len(indices) // 2
                        selected_indices.append(indices[mid_idx])
                    elif remaining_needed == 2:
                        selected_indices.append(indices[0])
                        selected_indices.append(indices[-1])
                    else:
                        step = (len(indices) - 1) / (remaining_needed - 1)

                        for i in range(remaining_needed):
                            index = int(round(i * step))
                            if index < len(indices):
                                selected_indices.append(indices[index])

            selected_indices.sort()

        lines = text.split("\n")
        heading_positions = {}

        for i, line in enumerate(lines):
            line_stripped = line.strip()
            if line_stripped.startswith("#"):
                for heading_idx, heading in enumerate(headings):
                    if heading == line_stripped and heading_idx not in heading_positions:
                        heading_positions[heading_idx] = i
                        break

        for i, heading_idx in enumerate(selected_indices):
            if heading_idx not in heading_positions:
                continue

            heading = headings[heading_idx]
            heading_line_idx = heading_positions[heading_idx]

            if i + 1 < len(selected_indices):
                next_heading_idx = selected_indices[i + 1]
                if next_heading_idx in heading_positions:
                    next_heading_line_idx = heading_positions[next_heading_idx]
                    content_end = next_heading_line_idx
                else:
                    content_end = len(lines)
            else:
                content_end = len(lines)

            content_lines = lines[heading_line_idx + 1 : content_end]
            content = "\n".join(content_lines).strip()

            chunk = DocumentChunk(
                heading=heading,
                content=content,
                heading_index=heading_idx,
                score=heading_scores[heading_idx],
            )
            chunks.append(chunk)

        return chunks

    async def get_n_chunks(self, text: str, n: int) -> list[DocumentChunk]:
        headings = await asyncio.to_thread(self.extract_headings, text)
        heading_scores = await asyncio.to_thread(self.score_headings, headings)
        chunks = await asyncio.to_thread(
            self.get_chunks_from_headings, text, headings, heading_scores, n
        )
        if len(chunks) < n:
            raise ValueError(f"Only {len(chunks)} chunks found, requested {n}")
        return chunks
