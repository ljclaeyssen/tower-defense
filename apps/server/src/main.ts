import { defineServer } from 'colyseus';

const port = Number(process.env['PORT'] ?? 2567);

const server = defineServer({
  rooms: {},
  express: (app) => {
    app.get('/health', (_req, res) => {
      res.json({ ok: true });
    });
  },
});

void server.listen(port);
