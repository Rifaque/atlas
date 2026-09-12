const port = process.env.ATLAS_CDP_PORT ?? '9444';
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
const target = targets.find((candidate) => candidate.type === 'page' && candidate.title === 'Atlas');
if (!target) throw new Error('No installed Atlas WebView target was found.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let sequence = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  if (message.error) handler.reject(new Error(message.error.message));
  else handler.resolve(message.result);
});

function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

const [action = 'snapshot', selectorValue = '', inputValue = ''] = process.argv.slice(2);
if (action === 'click-text') {
  const clicked = await evaluate(`(() => {
    const value = ${JSON.stringify(selectorValue)};
    const element = [...document.querySelectorAll('button,[role="tab"]')].find((candidate) => candidate.textContent.trim() === value);
    if (!element) return false;
    element.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`No control with exact text: ${selectorValue}`);
} else if (action === 'click-aria') {
  const clicked = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(`[aria-label="${selectorValue.replaceAll('"', '\\"')}"]`)});
    if (!element) return false;
    element.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`No control with aria-label: ${selectorValue}`);
} else if (action === 'fill-aria') {
  const filled = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(`[aria-label="${selectorValue.replaceAll('"', '\\"')}"]`)});
    if (!element) return false;
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(inputValue)});
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!filled) throw new Error(`No input with aria-label: ${selectorValue}`);
} else if (action === 'submit-aria') {
  const submitted = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(`[aria-label="${selectorValue.replaceAll('"', '\\"')}"]`)});
    const form = element?.closest('form');
    if (!form) return false;
    form.requestSubmit();
    return true;
  })()`);
  if (!submitted) throw new Error(`No form for input with aria-label: ${selectorValue}`);
} else if (action === 'wait-text') {
  const timeout = Number(inputValue || 60_000);
  const deadline = Date.now() + timeout;
  let found = false;
  while (Date.now() < deadline) {
    found = await evaluate(`document.body.innerText.includes(${JSON.stringify(selectorValue)})`);
    if (found) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!found) throw new Error(`Timed out waiting for text: ${selectorValue}`);
} else if (action === 'wait-no-control-text') {
  const timeout = Number(inputValue || 60_000);
  const deadline = Date.now() + timeout;
  let found = true;
  while (Date.now() < deadline) {
    found = await evaluate(`[...document.querySelectorAll('button,[role="tab"]')].some((element) => element.textContent.trim() === ${JSON.stringify(selectorValue)})`);
    if (!found) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (found) throw new Error(`Timed out waiting for control to disappear: ${selectorValue}`);
} else if (action !== 'snapshot') {
  throw new Error(`Unknown action: ${action}`);
}

await new Promise((resolve) => setTimeout(resolve, action === 'snapshot' ? 0 : 500));
const result = await evaluate(`JSON.stringify({
    title: document.title,
    text: document.body.innerText,
    controls: [...document.querySelectorAll('button,input,textarea,[role="tab"]')].map((element) => ({
      tag: element.tagName,
      text: element.innerText || element.value || '',
      ariaLabel: element.getAttribute('aria-label'),
      placeholder: element.getAttribute('placeholder'),
      disabled: element.disabled,
    }))
  })`);

console.log(JSON.stringify(JSON.parse(result), null, 2));
socket.close();
