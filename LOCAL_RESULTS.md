# Local practice result

The kit conformance runner passed all 120 checks on Node 22:

| Group | Passed |
| --- | ---: |
| Git | 30/30 |
| Repositories | 15/15 |
| Issues | 15/15 |
| Pull requests | 20/20 |
| REST protocol | 5/5 |
| GraphQL | 20/20 |
| MCP | 15/15 |

The SDK benchmark reported these median times across three rounds:

| Workload | Median |
| --- | ---: |
| Push | 595.406 ms |
| Clone | 217.685 ms |
| Read | 634.340 ms |
| Write | 125.467 ms |

The kit's `grade-local --driver process --instances 1` also passed the register/done lifecycle and
replayed deterministically. It scored 600 feature, 200 agent-native, 158 performance, for 958 total.
The local grader reported that this run had no transcript bundle, so its transcript coverage and
eligibility checks were not satisfied by that grading command.
