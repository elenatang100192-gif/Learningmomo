// 联调脚本
const http = require('http');

function req(path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: process.env.PORT || 3200, path, method, headers }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: buf ? JSON.parse(buf) : null });
        } catch {
          resolve({ status: res.statusCode, body: buf });
        }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  const u = { 'x-user-id': 'test_user_001', 'content-type': 'application/json' };

  console.log('\n===== 1) GET /api/courses?level=K1 =====');
  const r1 = await req('/api/courses?level=K1', { headers: u });
  console.log('status:', r1.status);
  if (Array.isArray(r1.body)) {
    console.log('共', r1.body.length, '门课');
    for (const c of r1.body) {
      console.log(`  - [${c.level}] ${c.title} (lessons=${c.lessons.length})`);
      for (const l of c.lessons) {
        console.log(`      • ${l.title}  status=${l.status}  id=${l.id}`);
      }
    }
  } else console.log(r1.body);

  if (!Array.isArray(r1.body) || !r1.body.length) return;

  const course = r1.body[0];
  const lesson1 = course.lessons[0];

  console.log('\n===== 2) GET /api/lessons/:id =====');
  const r2 = await req('/api/lessons/' + lesson1.id, { headers: u });
  console.log('status:', r2.status, 'title=', r2.body.title, 'steps=', r2.body.steps.length);
  for (const s of r2.body.steps) console.log('  -', s.type, s.sortOrder, '->', JSON.stringify(s.content).slice(0, 60));

  // 找一个 QUIZ step
  const quiz = r2.body.steps.find((s) => s.type === 'QUIZ');
  if (quiz) {
    console.log('\n===== 3) POST /api/quiz/grade (答案错) =====');
    const r3 = await req('/api/quiz/grade', { method: 'POST', headers: u, body: { stepId: quiz.id, answers: ['__wrong__'] } });
    console.log(r3.body);

    console.log('\n===== 4) POST /api/quiz/grade (正确答案) =====');
    // 根据 content.answer 走正确答案
    const ans = quiz.content.answer;
    const r4 = await req('/api/quiz/grade', { method: 'POST', headers: u, body: { stepId: quiz.id, answers: ans } });
    console.log(r4.body);
  }

  console.log('\n===== 5) POST /api/progress/complete =====');
  const r5 = await req('/api/progress/complete', { method: 'POST', headers: u, body: { lessonId: lesson1.id, starsEarned: 3 } });
  console.log(r5.body);

  console.log('\n===== 6) GET /api/courses 再次查看解锁状态 =====');
  const r6 = await req('/api/courses?level=K1', { headers: u });
  if (Array.isArray(r6.body)) {
    for (const c of r6.body) {
      for (const l of c.lessons) console.log(`  - ${l.title} status=${l.status}`);
    }
  }

  // ===== 家长端 =====
  console.log('\n===== 7) 家长注册 =====');
  const r7 = await req('/api/parent/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { phone: '13800000001', password: '123456', nickname: '妈妈A' },
  });
  console.log(r7.body);
  if (!r7.body || !r7.body.token) return;
  const tok = r7.body.token;

  console.log('\n===== 8) 添加孩子 =====');
  const r8 = await req('/api/parent/children', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-parent-token': tok },
    body: { nickname: '小明', ageYears: 5, level: 'K1' },
  });
  console.log(r8.body);
  if (!r8.body || !r8.body.id) return;
  const childId = r8.body.id;

  console.log('\n===== 9) 列出孩子 =====');
  const r9 = await req('/api/parent/children', { headers: { 'x-parent-token': tok } });
  console.log(JSON.stringify(r9.body, null, 2));

  console.log('\n===== 10) 学习报告 =====');
  const r10 = await req('/api/parent/report/' + childId, { headers: { 'x-parent-token': tok } });
  console.log(JSON.stringify(r10.body, null, 2));
})().catch((e) => {
  console.error('出错：', e);
  process.exit(1);
});
