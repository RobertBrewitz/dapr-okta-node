import Koa from 'koa';
import Router from 'koa-router';
import axios from 'axios';
import bodyparser from 'koa-bodyparser';
import cors from '@koa/cors';
import env from 'env-var';
import { v4 } from 'uuid';

const DAPR_HTTP_PORT = env.get('DAPR_HTTP_PORT').asPortNumber();
const STATE_ENDPOINT = `http://localhost:${DAPR_HTTP_PORT}/v1.0/state/state-name`;

const app = new Koa();
const router = new Router();

const setUserId = async (ctx: Koa.Context, next: Koa.Next) => {
  try {
    const jwtToken = ctx.req.headers.authorization.split(' ')[1];
    const encodedPayload = jwtToken.split('.')[1];
    const decodedPayload = JSON.parse(
      Buffer.from(encodedPayload, 'base64').toString('utf-8')
    );

    ctx.state.userId = decodedPayload.uid;
  } catch (err) {
    console.log(err);
    ctx.throw(401);
  }

  await next();
};

router.post('/subscriber', async (ctx) => {
  try {
    const {
      data: { uuid },
    } = ctx.request.body;

    const { data } = await axios.get(`${STATE_ENDPOINT}/${uuid}`);
    console.log(`Fetched state from subscription:`, data);

    // ACK
    ctx.status = 200;
  } catch (err) {
    ctx.throw(500);
  }
});

router.post('/publish', setUserId, async (ctx) => {
  const uuid = v4();

  try {
    const state = [
      {
        key: uuid,
        value: { timestamp: Date.now(), publisher: ctx.state.userId },
      },
    ];

    await axios.post(
      `http://localhost:${DAPR_HTTP_PORT}/v1.0/state/state-name`,
      state
    );

    await axios.post(
      `http://localhost:${DAPR_HTTP_PORT}/v1.0/publish/pubsub-name/topic-name`,
      { uuid }
    );

    ctx.body = `Message published by userId ${ctx.state.userId}`;
  } catch (err) {
    ctx.throw(500);
  }
});

app.use(cors());
app.use(
  bodyparser({
    extendTypes: {
      json: ['application/cloudevents+json'],
    },
  })
);

app.use(router.routes());

app.listen(3000, () => console.log('dapr-example is running on port 3000'));
