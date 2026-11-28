# Bulk import (SPEC 16.6)

`npm run import` turns a CSV file or an Anki export into a **new pack of draft questions**. It records where the questions came from and their license in `pack.json`, registers the new IDs and runs the validator. It never changes an existing pack. Every imported question is `status: draft` until Martin verifies it (in the app's Draft review, then `npm run apply-decisions`).

```
npm run import -- --file questions.csv --pack neuro-basics --title "Neuro basics" \
  --license "CC-BY-4.0" --origin "Martin's lecture notes" --domain science:Science
```

- `--pack`: the new pack ID (lowercase kebab-case); the folder must not exist yet.
- `--license` and `--origin` are required; the repo is public, so only import material you may publish.
- `--domain id:Label`: the Library shelf to put it on (an existing domain ID such as `science`, or a new one). Default `imported:Imported`.

## CSV

First row is the header; columns can be in any order. Fields with commas, quotes or line breaks go in double quotes (`""` for a quote). Lists use `|`.

| Column | Required | Meaning |
|---|---|---|
| `type` | yes | `mcq`, `recall` or `short` |
| `prompt` | yes | The question |
| `answer` | yes | MCQ: the correct option. Recall: the model answer. Short: accepted answers, `|`-separated |
| `options` | MCQ | 3 or 4 wrong options, `|`-separated |
| `topic` | no | Topic label; topics are created as needed (default "Imported") |
| `tier` | no | `foundational` (default), `advanced` or `expert` |
| `explanation` | no | 1 to 3 sentences (defaults to the answer) |
| `source` | no | Citation (defaults to `--origin`) |
| `tags` | no | `|`-separated |

```
type,topic,tier,prompt,answer,options,explanation,source,tags
mcq,Neurons,foundational,"What carries signals away from a neuron's cell body?",The axon,The dendrite|The synapse|The myelin sheath,"Axons conduct action potentials away from the soma.","Kandel et al., Principles of Neural Science",neurons
recall,Neurons,,What is a synapse?,The junction where one neuron signals another,,,,
```

Rows with problems are listed by line and skipped; nothing is written if no row is valid.

## Anki

In Anki use **File > Export > Notes in Plain Text** (tab-separated). Each note's first field becomes the prompt and the second the answer of a `recall` draft; HTML is stripped. Use a `.txt` file name.
