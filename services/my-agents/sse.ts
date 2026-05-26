export type ServerSentEvent = {
  event: string;
  data: string;
  id?: string;
};

function parseEventBlock(block: string): ServerSentEvent | null {
  const lines = block.split(/\r?\n/);
  let event = "message";
  let id: string | undefined;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    const separatorIndex = line.indexOf(":");
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
    const value =
      separatorIndex === -1
        ? ""
        : line.slice(separatorIndex + 1).replace(/^ /, "");

    if (field === "event") event = value;
    if (field === "data") dataLines.push(value);
    if (field === "id") id = value;
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n"), id };
}

export async function* streamServerSentEvents(
  response: Response,
): AsyncGenerator<ServerSentEvent> {
  if (!response.body) throw new Error("Streaming response body is missing.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const event = parseEventBlock(block);
      if (event) yield event;
    }
  }

  buffer += decoder.decode();
  const finalEvent = parseEventBlock(buffer.trim());
  if (finalEvent) yield finalEvent;
}
