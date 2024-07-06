// Express와 OpenAI 모듈, 환경 변수 설정을 위한 dotenv 모듈을 가져옵니다.
import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import cors from 'cors';

// .env 파일의 내용을 환경 변수로 불러옵니다.
dotenv.config();

// Express 애플리케이션 인스턴스를 생성합니다.
const app = express();
const PORT = process.env.PORT || 3000; // 포트 번호를 설정합니다. 환경 변수에 설정된 PORT가 없으면 기본값으로 3000을 사용합니다.

// OpenAI 인스턴스를 생성합니다. 환경 변수에서 API 키를 가져옵니다.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// CORS 설정 객체를 정의합니다.
const corsOptions = {
  origin: [
    "https://web-math-front-backup-ly9ixsuqeb5112cb.sel5.cloudtype.app/"
  ],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE", // 허용되는 HTTP 메서드를 정의합니다.
  credentials: true,
  optionsSuccessStatus: 204,
};

// 애플리케이션에 CORS 설정을 적용합니다.
app.use(cors(corsOptions));
app.use(express.json()); // JSON 요청 본문을 파싱하기 위해 Express의 JSON 미들웨어를 사용합니다.

// 모든 경로에 대해 Pre-flight 요청을 허용하도록 합니다.
app.options('*', cors(corsOptions));

// POST 요청을 처리하는 '/solve-equation' 엔드포인트를 정의합니다.
app.post('/solve-equation', async (req, res) => {
  const { equation } = req.body; // 요청 본문에서 'equation'을 가져옵니다.

  try {
    // 수학 선생님 Assistant를 생성합니다.
    const assistant = await openai.beta.assistants.create({
      name: "수학 선생님",
      instructions: "당신은 개인 수학 선생님입니다. 코드를 써서 수학 질문에 답해주세요. 친절하게 답해주세요.",
      tools: [{ type: "code_interpreter" }],
      model: "gpt-4o"
    });

    // 새로운 스레드를 생성합니다.
    const thread = await openai.beta.threads.create();

    // 스레드에 사용자 메시지를 추가합니다.
    await openai.beta.threads.messages.create(
      thread.id,
      {
        role: "user",
        content: `저는 방정식을 풀어야해요 \`${equation}\`. 도와줄 수 있나요?`
      }
    );

    let responseText = ''; // 응답 텍스트를 저장할 변수를 초기화합니다.

    // Assistant의 응답을 스트리밍으로 받습니다.
    const run = openai.beta.threads.runs.stream(thread.id, {
      assistant_id: assistant.id
    });

    // 텍스트 생성 이벤트를 처리합니다.
    run.on('textCreated', (text) => {
      console.log('\nassistant > ', text);
      responseText += text; // 응답 텍스트를 수집합니다.
    });

    // 텍스트 델타 이벤트를 처리합니다.
    run.on('textDelta', (textDelta) => {
      console.log(textDelta.value);
      responseText += textDelta.value; // 응답 텍스트를 수집합니다.
    });

    // 도구 호출 생성 이벤트를 처리합니다.
    run.on('toolCallCreated', (toolCall) => {
      console.log(`\nassistant > ${toolCall.type}\n\n`);
    });

    // 도구 호출 델타 이벤트를 처리합니다.
    run.on('toolCallDelta', (toolCallDelta) => {
      if (toolCallDelta.type === 'code_interpreter') {
        if (toolCallDelta.code_interpreter.input) {
          console.log(toolCallDelta.code_interpreter.input);
          responseText += toolCallDelta.code_interpreter.input; // 응답 텍스트를 수집합니다.
        }
        if (toolCallDelta.code_interpreter.outputs) {
          console.log("\noutput >\n");
          toolCallDelta.code_interpreter.outputs.forEach(output => {
            if (output.type === "logs") {
              console.log(`\n${output.logs}\n`);
              responseText += output.logs; // 응답 텍스트를 수집합니다.
            }
          });
        }
      }
    });

    // 스트림이 끝날 때 응답을 반환합니다.
    run.on('end', () => {
      res.status(200).json({ response: responseText });
    });

  } catch (error) {
    console.error(error); // 오류가 발생하면 콘솔에 로그를 출력합니다.
    res.status(500).send('An error occurred'); // 500 상태 코드와 함께 오류 메시지를 반환합니다.
  }
});

// 서버를 시작합니다.
app.listen(PORT, function () {
  console.log(`${PORT}번 포트에서 서버가 실행 중입니다.`);
});
