# llm-sampling

A very simple interactive demo to understand the common LLM samplers. Released
under the Apache License, version 2.0.

[**See an online demo here.**](https://artefact2.github.io/llm-sampling/index.xhtml)

# Quickstart

```
git clone https://github.com/ggerganov/llama.cpp
make -C llama.cpp server

# json array of strings (prompts)
$EDITOR in.json

systemd-run --user ./llama.cpp/server --host 127.0.0.1 --port 24498 -c 8192 -np 16 -cb -m foo.gguf
make out.json
```
