<template>
  <div class="flex flex-col gap-4">
    <article
      class="flex-grow min-h-40 max-h-125 max-w-none overflow-auto px-10 prose"
    >
      <p
        v-if="reply"
        v-html="marked(reply)"
        class="bg-surface-container-highest rounded-xl px-4 py-3"
      />
    </article>
    <div class="flex gap-4">
      <md-outlined-text-field
        type="text"
        :value="message"
        @input="message = $event.target.value"
        placeholder="Enter your message here"
        class="flex-grow"
        @keydown.enter="sendMessage"
      />
      <md-filled-button @click="sendMessage" class="min-w-40"
        >Send</md-filled-button
      >
    </div>
  </div>
</template>
<script lang="ts" setup>
import { CreateMLCEngine } from '@mlc-ai/web-llm';
import { ref } from 'vue';
import { marked } from 'marked';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/button/filled-button.js';

const selectedModel = 'Llama-3.2-3B-Instruct-q4f32_1-MLC';

const engine = await CreateMLCEngine(selectedModel, {
  initProgressCallback: ({ progress }) => {
    console.log(`Initialization progress: ${progress}%`);
  },
});

const message = ref('');
const reply = ref('');

const sendMessage = async () => {
  const messages = [
    {
      role: 'user',
      content: message.value,
    },
  ];
  const chunks = await engine.chat.completions.create({
    // @ts-ignore
    messages,
    stream: true,
  });

  reply.value = ''; // Reset the reply before appending new content
  for await (const chunk of chunks) {
    reply.value += chunk.choices[0].delta.content || '';
  }
  message.value = ''; // Clear the input field after sending the message
};
</script>
