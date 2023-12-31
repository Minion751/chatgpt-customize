import endent from 'endent';
import {
  createParser,
  ParsedEvent,
  ReconnectInterval,
} from 'eventsource-parser';

const createPrompt = (inputCode: string) => {
  const data = (inputCode: string) => {
    return endent`${inputCode}`;
  };

  if (inputCode) {
    return data(inputCode);
  }
};
// console.log('ssss=>',createPrompt )

export const OpenAIStream = async (
  inputCode: string,
  model: string,
  key: string | undefined,
) => {
  const prompt = createPrompt(inputCode);
  const direct_prompt = "You are amazon seller assistant. You will try to respond to user's questions, but you get easily distracted.Build an Amazon Seller Assistant that provides comprehensive insights and recommendations to optimize product listings, increase sales, and enhance the overall performance of sellers on the Amazon marketplace. The assistant should leverage AI and data analytics techniques to analyze seller data, competitor information, and market trends to deliver actionable insights and automate repetitive tasks. It should assist sellers in areas such as product research, pricing optimization, inventory management, keyword optimization, review monitoring, and competitor analysis. The assistant should also provide real-time notifications and alerts for important events, such as changes in product rankings, pricing fluctuations, or negative reviews. The goal is to empower Amazon sellers with intelligent tools and recommendations to maximize their success on the platform.";

  const system = { role: 'system', content:   `${prompt}\n${direct_prompt}` };
  console.log('system-->', system);

  const res = await fetch(`https://api.openai.com/v1/chat/completions`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key || process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
    },
    method: 'POST',
    body: JSON.stringify({
      model,
      messages: [system],
      temperature: 0,
      stream: true,
    }),
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  if (res.status !== 200) {
    const statusText = res.statusText;
    const result = await res.body?.getReader().read();
    throw new Error(
      `OpenAI API returned an error: ${
        decoder.decode(result?.value) || statusText
      }`,
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          const data = event.data;

          if (data === '[DONE]') {
            controller.close();
            return;
          }

          try {
            const json = JSON.parse(data);
            const text = json.choices[0].delta.content;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
};
