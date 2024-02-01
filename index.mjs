import fetch from "node-fetch";

export const handler = awslambda.streamifyResponse(
    async (event, responseStream, context) => {
        try {
            responseStream.setContentType("text/plain");
            const data = event.body ? JSON.parse(event.body) : event,
                stream = await fetchStream(data);
            stream.on("readable", () => {
                let chunk;
                while (null !== (chunk = stream.read())) {
                    parseDecoded({ chunk, responseStream });
                }
            });
            stream.on("end", () => {
                responseStream.end();
            });
        } catch (err) {
            responseStream.write(err.message);
            responseStream.end();
        }
    }
);

async function fetchStream(data) {
    data.stream = true;
    const { apiKeyName } = data;
    delete data.apiKeyName;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env[apiKeyName]}`,
        },
        body: JSON.stringify(data),
    });
    return response.body;
}

function parseDecoded({ chunk, responseStream }) {
    const data = ("" + chunk)
        .split("data:")
        .map((line) => {
            try {
                return JSON.parse(line.trim());
            } catch (err) {
                return {};
            }
        })
        .map(({ choices }) => choices || {})
        .flat(Infinity)
        .map(({ delta }) => delta?.content);
    for (const piece of data) {
        piece && responseStream.write(piece);
    }
}
