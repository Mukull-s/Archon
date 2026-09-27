import 'dotenv/config';
import axios from 'axios';

/**
 * One-shot verification of the optional OpenAI-compatible LLM gateway.
 * Never prints the API key. Run: npx ts-node --transpile-only scripts/verify-gateway.ts
 */
function reportConfig() {
  const baseUrl = (process.env.MERGE_GATEWAY_BASE_URL || '').replace(/\/+$/, '');
  const model = process.env.MERGE_GATEWAY_MODEL || '';
  const key = process.env.MERGE_GATEWAY_API_KEY || '';
  console.log('--- gateway config ---');
  console.log(`LLM_PROVIDER         : ${process.env.LLM_PROVIDER || '<not set>'}`);
  console.log(`MERGE_GATEWAY_BASE_URL: ${baseUrl || '<empty>'}`);
  console.log(`MERGE_GATEWAY_MODEL  : ${model || '<empty>'}`);
  console.log(
    `MERGE_GATEWAY_API_KEY: ${key ? `<set len=${key.length} tail=***${key.slice(-4)}>` : '<empty>'}`
  );
  return { baseUrl, model, key };
}

async function main() {
  const { baseUrl, model, key } = reportConfig();
  if (!baseUrl || !model || !key) {
    console.log('\nRESULT: gateway NOT configured (need base URL + key + model).');
    process.exit(1);
  }
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  // 1) Models list (shape probe)
  console.log('\n--- GET /models ---');
  try {
    const r = await axios.get(`${baseUrl}/models`, { headers, timeout: 15000 });
    const ids = Array.isArray(r.data?.data) ? r.data.data.map((m: any) => m.id) : null;
    console.log(`status: ${r.status}`);
    console.log(`openai-shaped: ${ids ? 'yes' : 'no'}`);
    if (ids) {
      console.log(`model count: ${ids.length}`);
      console.log(`requested model present: ${ids.includes(model)}`);
      const sample = ids.filter((id: string) => /deepseek/i.test(id)).slice(0, 12);
      if (sample.length) console.log(`deepseek models: ${sample.join(', ')}`);
    } else {
      console.log(`body preview: ${JSON.stringify(r.data).slice(0, 200)}`);
    }
  } catch (e: any) {
    console.log(`status: ${e.response?.status ?? 'error'} — ${e.message}`);
  }

  // 2) Non-streaming chat completion
  console.log('\n--- POST /chat/completions (non-streaming) ---');
  let chatOk = false;
  try {
    const r = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model,
        messages: [
          { role: 'system', content: 'You are a concise assistant.' },
          { role: 'user', content: 'Reply with exactly the word: OK' }
        ],
        temperature: 0.1
      },
      { headers, timeout: 40000 }
    );
    const content = r.data?.choices?.[0]?.message?.content;
    console.log(`status: ${r.status}`);
    console.log(`model echoed: ${r.data?.model ?? '<none>'}`);
    console.log(`content: ${JSON.stringify(content)}`);
    chatOk = typeof content === 'string' && content.length > 0;
  } catch (e: any) {
    console.log(`status: ${e.response?.status ?? 'error'} — ${e.message}`);
    if (e.response?.data) console.log(`body: ${JSON.stringify(e.response.data).slice(0, 300)}`);
  }

  // 3) Streaming
  console.log('\n--- POST /chat/completions (stream) ---');
  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with exactly: hello world' }],
        stream: true
      })
    });
    console.log(`status: ${resp.status}`);
    if (resp.ok && resp.body) {
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let contentEvents = 0;
      let reasoningEvents = 0;
      let contentText = '';
      /** Read to the end so late-arriving content (after the thinking phase) is counted. */
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') { buf = ''; }
          try {
            const p = JSON.parse(payload);
            const d = p.choices?.[0]?.delta || {};
            if (typeof d.content === 'string' && d.content) { contentEvents++; contentText += d.content; }
            if (typeof d.thinking === 'string' && d.thinking) reasoningEvents++;
            else if (typeof d.reasoning_content === 'string' && d.reasoning_content) reasoningEvents++;
          } catch {}
        }
      }
      reader.releaseLock();
      console.log(`stream content events: ${contentEvents} | reasoning events: ${reasoningEvents}`);
      console.log(`stream final content: ${JSON.stringify(contentText.slice(0, 120))}`);
    }
  } catch (e: any) {
    console.log(`error: ${e.message}`);
  }

  // 4) Full integration through llm.service (gateway now auto-enables from creds)
  console.log('\n--- llm.service integration ---');
  try {
    const { llmService } = require('../src/services/llm.service');
    const summaryRaw = await llmService.generateRepositorySummary({
      name: 'smoke-test',
      framework: 'Express',
      languages: ['TypeScript'],
      fileCount: 3,
      totalSize: 1000,
      fileTree: '- src/index.ts\n- src/app.ts\n- src/db.ts'
    });
    console.log(`generateRepositorySummary: OK (${typeof summaryRaw}, ${summaryRaw.length} chars)`);
    const parsed = (() => { try { return JSON.parse(summaryRaw); } catch { return null; } })();
    console.log(`summary valid JSON: ${parsed ? 'yes' : 'no (will fall back to prose wrapper)'}`);
    if (parsed?.summary) console.log(`summary.summary: ${String(parsed.summary).slice(0, 120)}`);

    const answer = await llmService.chat({
      prompt: 'Reply with exactly the word: OK',
      contextChunks: [],
      model: 'qwen/qwen3-coder:free'
    });
    console.log(`chat: OK (modelUsed=${answer.modelUsed}) content=${JSON.stringify(String(answer.text).slice(0, 60))}`);
  } catch (e: any) {
    console.log(`llm.service integration FAILED: ${e.message}`);
  }

  console.log(`\nRESULT: ${chatOk ? '✅ gateway responds to chat completions' : '❌ chat completions failed'}`);
  process.exit(chatOk ? 0 : 1);
}

main().catch((e) => {
  console.error('verify-gateway crashed:', e?.message || e);
  process.exit(1);
});
