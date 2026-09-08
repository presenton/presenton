# Presenton Resource Usage Report

**Test date:** 2026-09-02  
**Observation window:** 17:28:23 to 18:20:13 (+05:45)  
**Duration:** 51 minutes 50 seconds  
**Samples:** 1,551  
**Sampling interval:** approximately 2 seconds  
**Container:** `Presenton`  
**Test type:** Controlled k6 concurrency/load and resource-usage test  
**Profile:** `presentation4`  
**Concurrent users:** 4 virtual users per wave  
**Workload:** Four waves; 16 complete presentation-generation workflows in total  
**Target:** `http://127.0.0.1:5001`

## Executive summary

Presenton remained comparatively steady for most of the 51-minute observation window, but entered a substantially heavier resource-usage period during the final minute. Across the full run, median CPU utilization was **3.70%**, the processor queue was zero in **97.4%** of samples, and memory utilization remained at or below **21.36%** through the 95th percentile.

Before 18:19:15, memory utilization rose gradually from **17.42%** to **21.49%**, available/free memory declined from **6,031.36 MB** to **5,733.38 MB**, and heap memory increased from **2,670.32 MB** to **3,271.32 MB**. This long portion of the run had average CPU utilization of **14.78%** and a maximum processor queue length of **2**.

The final 59 seconds were materially different. Average CPU utilization increased to **337.87%**, average processor queue length increased to **1.00**, memory utilization reached **37.09%**, available/free memory fell to **4,594.69 MB**, and heap memory peaked at **11,866.22 MB**. The recording ended while resource usage was still elevated, so the artifacts do not demonstrate post-load recovery.

## Test controls and interpretation limits

The resource CSV and HTML provide timestamped CPU, processor-queue, memory-utilization, available/free-memory, and heap-memory measurements. The matching k6 runner, workload definition, and result summaries identify the workload and API calls. They do not identify:

- The host's total logical CPU count.
- OOM events, swap activity, container restarts, or application-log delivery.

Consequently, this report can associate the monitoring period with the repeated presentation-generation workload, but it cannot attribute an individual resource sample to one endpoint or virtual user. CPU readings above 100% are reported as captured and represent combined container utilization across logical processors; for example, 400% is approximately four fully used logical CPU cores.

Memory utilization and available/free memory are container-level measurements. `heap_memory_mb` is not a managed-runtime heap counter; it is an estimate calculated by summing Linux `VmData` for the processes in the container. It should therefore be interpreted as aggregate process data/heap allocation.

## Workload and concurrency model

This was a **controlled concurrency/load test** executed with k6, combined with continuous container resource monitoring. It was not an open-ended request-rate test or a progressively increasing stress test. The `presentation4` profile uses k6's `per-vu-iterations` executor with **4 virtual users (VUs)** and **1 iteration per VU**. All four users therefore begin one expensive end-to-end presentation workflow in the same controlled concurrency wave, and a faster VU does not start a second workflow after it finishes.

The matrix repeated that four-user wave **four times**, with a configured **60-second cooldown** between runs:

| Run | Start time | Concurrent VUs | Presentation sizes | Completed workflows | HTTP requests | HTTP failure rate |
|---:|---|---:|---|---:|---:|---:|
| 1 | 17:28:26 | 4 | 10, 20, 30, and 40 slides | 4 | 24 | 0.00% |
| 2 | 17:41:07 | 4 | 10, 20, 30, and 40 slides | 4 | 24 | 0.00% |
| 3 | 17:52:58 | 4 | 10, 20, 30, and 40 slides | 4 | 24 | 0.00% |
| 4 | 18:04:06 | 4 | 10, 20, 30, and 40 slides | 4 | 24 | 0.00% |
| **Total** | 17:28:26–approximately 18:15:12 | **4 maximum at once** | **Four of each size** | **16** | **96** | **0.00%** |

Within every wave:

- VU 1 generated a 10-slide presentation.
- VU 2 generated a 20-slide presentation.
- VU 3 generated a 30-slide presentation.
- VU 4 generated a 40-slide presentation.

The four-user limit means there were **4 simultaneous users**, not 16 simultaneous users. The figure of 16 is the cumulative number of presentation workflows completed across the four repeated waves. The users were assigned separate `Testuser1` through `Testuser4` accounts and separately authenticated sessions to prevent cookie or presentation-ID sharing between VUs.

Each run recorded 4 completed iterations, 24 HTTP requests, 28 successful checks, no failed checks, and no workflow failures. Across the matrix this gives **16 completed workflows, 96 HTTP requests, 112 successful checks, and zero recorded HTTP or workflow failures**. PPTX export was not part of this workload.

## Targeted endpoints

The base target was the local Presenton service at `http://127.0.0.1:5001`. Authentication was completed sequentially during k6 setup; the five-step presentation workflow was then executed concurrently by all four VUs.

| Order | Method and endpoint | Purpose | Execution model |
|---:|---|---|---|
| Setup | `POST /api/v1/auth/login` | Authenticate each test account and obtain its `presenton_session` cookie | 4 logins, sequentially before the timed concurrent workflow |
| 1 | `POST /api/v1/ppt/presentation/create` | Create a standard presentation and return its presentation ID | Once per VU per wave |
| 2 | `GET /api/v1/ppt/chat/conversations?presentation_id={id}&presentation_type=standard` | Retrieve the conversation associated with the new presentation | Once per VU per wave |
| 3 | `GET /api/v1/ppt/outlines/stream/{presentation_id}` | Generate and stream the presentation outline using server-sent events | Once per VU per wave |
| 4 | `POST /api/v1/ppt/presentation/prepare` | Submit the generated presentation ID, per-slide outline, and layout | Once per VU per wave |
| 5 | `GET /api/v1/ppt/presentation/stream/{presentation_id}` | Generate and stream the finished presentation using server-sent events | Once per VU per wave |

Every presentation used the standard v2 workflow in automatic English, with default tone, standard verbosity, no table of contents, no title slide, no web search, and a separate dynamically created presentation ID. The configured layout was resolved dynamically. Although the suite supports `POST /api/export-presentation`, export was disabled for this matrix so PPTX export time and resource use would not be mixed into the generation measurement.

## Overall resource summary

| Metric | Start | Average | Median | P95 | Maximum | End |
|---|---:|---:|---:|---:|---:|---:|
| CPU utilization | 0.53% | 21.03% | 3.70% | 43.27% | 1,087.09% | 579.11% |
| Processor queue length | 0 | 0.04 | 0 | 0 | 5 | 1 |
| Memory utilization | 17.42% | 19.85% | 20.19% | 21.36% | 37.09% | 37.09% |
| Available/free memory | 6,031.36 MB | 5,853.16 MB | 5,828.61 MB | 5,985.28 MB | 6,031.36 MB | 4,594.69 MB |
| Heap memory | 2,670.32 MB | 3,109.39 MB | 3,170.68 MB | 3,273.54 MB | 11,866.22 MB | 11,086.41 MB |

For available/free memory, a lower value indicates greater memory pressure; its P95 therefore describes the upper end of free-memory observations rather than a pressure threshold.

## Resource usage by time window

The observation window is divided into five equal chronological groups of approximately 10 minutes 20 seconds. Values below are the average and peak within each group.

| Window | Time range | Avg CPU | Peak CPU | Avg queue | Peak queue | Avg memory | Peak memory | Avg heap | Peak heap |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 17:28:23–17:38:43 | 15.63% | 1,087.09% | 0.03 | 2 | 18.01% | 18.15% | 2,747.98 MB | 2,773.43 MB |
| 2 | 17:38:45–17:49:05 | 17.25% | 611.98% | 0.01 | 1 | 18.74% | 20.29% | 2,854.17 MB | 3,130.09 MB |
| 3 | 17:49:07–17:59:27 | 16.51% | 758.08% | 0.02 | 1 | 19.87% | 20.21% | 3,150.06 MB | 3,171.40 MB |
| 4 | 17:59:29–18:09:49 | 15.28% | 653.96% | 0.02 | 2 | 20.56% | 21.07% | 3,197.28 MB | 3,251.43 MB |
| 5 | 18:09:51–18:20:13 | 40.39% | 968.07% | 0.10 | 5 | 22.08% | 37.09% | 3,595.86 MB | 11,866.22 MB |

The fifth window's averages are raised primarily by the final-minute burst. Before that burst, its readings remained much closer to the preceding windows.

## CPU usage

CPU utilization was bursty rather than continuously high. The run-wide median was **3.70%**, while the average was **21.03%**, indicating that short spikes pulled the mean upward. Of the 1,551 samples:

- 66 samples (**4.3%**) were at or above 100%.
- 56 samples (**3.6%**) were at or above 200%.
- 22 samples (**1.4%**) were at or above 400%.
- 4 samples (**0.3%**) were at or above 800%.

The maximum reading, **1,087.09%**, occurred at 17:28:29 near the start of monitoring. Because it was brief and the first ten minutes averaged **16.09%**, it is best treated as a transient spike rather than evidence of sustained saturation.

During the final-minute burst, CPU averaged **337.87%**, peaked at **834.81%**, and ended at **579.11%**. Without the host CPU count, these figures cannot be converted reliably into a percentage of total machine capacity.

## Processor queue behavior

The processor queue was zero in **1,511 of 1,551 samples (97.4%)**. It was nonzero in 40 samples and exceeded 1 in only 10 samples. Before the final minute, the maximum queue length was **2**.

Queue activity increased during the final-minute burst: the queue averaged **1.00**, reached its run maximum of **5** at 18:20:11, and ended at **1**. This coincided with elevated CPU and memory readings, indicating short-lived compute contention at the end of the capture.

## Memory and heap behavior

For the first 50 minutes 50 seconds, memory grew gradually:

| Metric | Initial sample | Pre-burst sample at 18:19:13 | Change |
|---|---:|---:|---:|
| Memory utilization | 17.42% | 21.49% | +4.07 percentage points |
| Available/free memory | 6,031.36 MB | 5,733.38 MB | -297.98 MB |
| Heap memory | 2,670.32 MB | 3,271.32 MB | +601.00 MB |

The final minute introduced much larger and rapidly reversing heap changes. Heap memory climbed from **3,329.35 MB** at 18:19:15 to the run peak of **11,866.22 MB** at 18:19:23, fell back to **3,274.40 MB** at 18:19:31, and then rose again in several waves. It ended at **11,086.41 MB**.

Available/free memory moved inversely during these bursts, reaching its minimum of **4,594.69 MB** in the final sample. Memory utilization simultaneously reached its maximum of **37.09%**. This alignment supports the interpretation that the late heap readings reflect a genuine increase in memory use within the monitored scope rather than an isolated reporting anomaly.

## Final-minute burst

| Metric | Before burst (1,521 samples) | Final minute (30 samples) |
|---|---:|---:|
| Average CPU utilization | 14.78% | 337.87% |
| P95 CPU utilization | 30.47% | 761.50% |
| Average processor queue | 0.02 | 1.00 |
| Maximum processor queue | 2 | 5 |
| Average memory utilization | 19.68% | 28.78% |
| Maximum memory utilization | 21.49% | 37.09% |
| Average available/free memory | 5,866.01 MB | 5,201.27 MB |
| Average heap memory | 3,038.40 MB | 6,708.38 MB |
| Maximum heap memory | 3,273.54 MB | 11,866.22 MB |

This is the clearest pressure interval in the artifacts. CPU, queue length, memory utilization, and heap memory all rose together, while available/free memory declined. Because the capture stopped during this interval, it is not possible to determine whether the resources would return to their earlier levels after the workload ended.

The fourth k6 run began at 18:04:06 and lasted approximately **11 minutes 6 seconds**, placing its completion near **18:15:12**. The sharp resource burst began around 18:19:15—approximately four minutes after k6 completed. It therefore did not occur while virtual users were actively issuing the measured workflow requests. It may represent delayed or background application work, worker cleanup, queued processing, or another process inside the monitored container, but the available artifacts do not identify the responsible process or endpoint. The resource capture ended during this post-test activity.

## Overall assessment

| Indicator | Observation | Assessment |
|---|---:|---|
| Sampling continuity | 1,551 samples; 2-second median interval; 3-second maximum gap | Complete and consistent telemetry |
| Typical CPU load | 3.70% median | Low between bursts |
| Typical processor queue | Zero in 97.4% of samples | Little sustained compute contention |
| Pre-burst memory growth | +4.07 percentage points over about 51 minutes | Gradual upward trend |
| Pre-burst heap growth | +601.00 MB | Net growth is visible but its cause is unknown |
| Final memory utilization | 37.09% | Run maximum; capture ended elevated |
| Final heap memory | 11,086.41 MB | 8,416.09 MB above the initial sample |
| Post-load recovery | Not captured | Cannot establish cleanup or retention behavior |

## Conclusion

Presenton showed low typical CPU demand, an almost always empty processor queue, and moderate memory use for most of the observation period. The long-term telemetry nevertheless shows a gradual increase in both memory utilization and heap memory before the final burst.

The last minute is the principal concern: all pressure indicators worsened together, heap memory repeatedly expanded into the 8–12 GB range, and the recording ended at the maximum observed memory utilization with CPU still elevated. This occurred about four minutes after the fourth and final k6 wave completed. The supplied data is sufficient to identify the post-test resource event, but not the exact endpoint or background process responsible, whether it caused user-visible failures, or whether memory was subsequently released.

A follow-up capture should include workload-stage markers and continue through a defined idle recovery period. Request latency, status counts, container restart/OOM counters, swap usage, and process/thread counts would make it possible to distinguish expected peak allocation from persistent resource retention.

## Raw artifacts

- `presenton-resource-usage.csv`
- `presenton-resource-usage.html`
- `run-performance-matrix.sh`
- `k6/presenton-concurrency.js`
- `results/k6-presentation-4vu-10-20-30-40-slides-run-1-20260902-172826.json`
- `results/k6-presentation-4vu-10-20-30-40-slides-run-2-20260902-174107.json`
- `results/k6-presentation-4vu-10-20-30-40-slides-run-3-20260902-175258.json`
- `results/k6-presentation-4vu-10-20-30-40-slides-run-4-20260902-180406.json`
