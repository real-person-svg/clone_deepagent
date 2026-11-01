import type { ModelReply, ToolCall } from '../../contracts/index';
import { uid } from '../../storage/index';
import type { LiveModelConfig, ModelAdapter, ModelRequest } from './types';

export class HttpModel implements ModelAdapter {
  constructor(private config: LiveModelConfig) {}
  async complete(request: ModelRequest): Promise<ModelReply> {
    const endpoint = `${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(this.config.timeoutMs || 120000),
    ]);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      signal,
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'system', content: request.agent.systemPrompt }, ...request.messages],
        tools: request.tools,
        stream: true,
        stream_options: { include_usage: true },
      }),
    });
    if (!response.ok) {
      // Never propagate provider bodies: they may contain credentials or prompts.
      const error = new Error(`模型服务返回 HTTP ${response.status}，请检查服务端模型配置或额度`);
      Object.assign(error, { status: response.status });
      throw error;
    }
    if (!response.body) throw new Error('模型服务没有返回响应体');
    const calls = new Map<number, ToolCall>();
    let reasoningContent: string | undefined;
    let content = '',
      buffer = '';
    let ended = false;
    let usage: ModelReply['usage'];
    const decoder = new TextDecoder();

    const consume = (frame: string) => {
      const data = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!data) return;
      if (data === '[DONE]') {
        ended = true;

        return;
      }
      const value = JSON.parse(data);
      if (value.error) throw new Error('模型服务在响应过程中返回错误');
      if (value.usage)
        usage = {
          input: value.usage.prompt_tokens || 0,
          output: value.usage.completion_tokens || 0,
        };
      const choice = value.choices?.[0],
        delta = choice?.delta;
      if (choice?.finish_reason) ended = true;
      if (typeof delta?.content === 'string') {
        content += delta.content;
        request.onText(delta.content);
      }
      if (typeof delta?.reasoning_content === 'string')
        reasoningContent = (reasoningContent || '') + delta.reasoning_content;
      for (const part of delta?.tool_calls || []) {
        const previous = calls.get(part.index) || {
          id: part.id || uid('call'),
          type: 'function' as const,
          function: { name: '', arguments: '' },
        };
        if (part.id) previous.id = part.id;
        if (part.function?.name) previous.function.name += part.function.name;
        if (part.function?.arguments) previous.function.arguments += part.function.arguments;
        calls.set(part.index, previous);
      }
    };
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        if (buffer.length > 2_000_000 || content.length + (reasoningContent?.length || 0) > 150000)
          throw new Error('模型响应超出大小限制');
        buffer = buffer.replaceAll('\r\n', '\n');
        let pos: number;
        while ((pos = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, pos);
          buffer = buffer.slice(pos + 2);
          consume(frame);
        }
      }
      if (buffer.trim()) consume(buffer);
      if (!ended) throw new Error('模型流提前中断；已接收内容保留在执行记录中');
      const reply: ModelReply = {
        content,
        toolCalls: [...calls.entries()].sort((a, b) => a[0] - b[0]).map(([, value]) => value),
        usage,
      };
      if (reasoningContent !== undefined) reply.reasoningContent = reasoningContent;

      return reply;
    } finally {
      reader.releaseLock();
    }
  }
}
