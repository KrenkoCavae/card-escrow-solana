import 'dotenv/config';
import OpenAI from 'openai';
import { cardEscrowPlugin } from './plugins/card-escrow/index.js';

const openai = new OpenAI({
  baseURL: process.env.LLM_BASE_URL || 'http://localhost:1234/v1',
  apiKey: process.env.LLM_API_KEY || 'sk-no-necesaria-local',
});

const model = process.env.LLM_MODEL || 'Qwen2.5-7B-Instruct';

const tools = cardEscrowPlugin.actions.map(action => ({
  type: 'function' as const,
  function: {
    name: action.name,
    description: action.description,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
}));

async function runAgent(pregunta: string) {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: 'Eres un asistente que consulta el estado del escrow de cartas TCG en Solana Devnet. Solo usas la herramienta CARD_ESCROW_RESUMEN para obtener datos reales. Nunca inventes números o estados.',
    },
    { role: 'user', content: pregunta },
  ];

  let response = await openai.chat.completions.create({
    model,
    messages,
    tools,
    tool_choice: 'auto',
  });

  const toolCalls = response.choices[0].message.tool_calls;
  if (toolCalls && toolCalls.length > 0) {
    for (const call of toolCalls) {
      if (call.function.name === 'CARD_ESCROW_RESUMEN') {
        const result = await cardEscrowPlugin.actions[0].execute();
        messages.push(response.choices[0].message);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    response = await openai.chat.completions.create({
      model,
      messages,
    });
  }

  console.log('\nRespuesta del agente:\n');
  console.log(response.choices[0].message.content);
}

const pregunta = process.argv.slice(2).join(' ') || 'Dame un resumen del escrow de cartas.';
runAgent(pregunta).catch(console.error);
