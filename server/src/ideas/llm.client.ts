import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);

  constructor(private readonly configService: ConfigService) {}

  async complete(prompt: string): Promise<string> {
    const apiKey = this.configService.get<string>('LLM_API_KEY');
    const customUrl = this.configService.get<string>('LLM_API_URL');
    const model =
      this.configService.get<string>('LLM_MODEL') || 'gemini-3.6-flash';

    let endpoint = customUrl;
    let requestBody: any;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (!endpoint) {
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      };
    } else {
      headers.Authorization = `Bearer ${apiKey}`;
      requestBody = {
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are an AI advisor that returns strictly structured JSON project proposals.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`LLM API returned status ${response.status}`);
    }

    const data = await response.json();
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    } else if (data?.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    return JSON.stringify(data);
  }
}
