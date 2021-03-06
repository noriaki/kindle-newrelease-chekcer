const jwt = require('jsonwebtoken');
const uuid = require('uuid/v4');
const routes = require('express').Router();
const { sendJSON } = require('next/dist/server/render');

const exchange = require('../../worker/amqp')();

const User = require('../../db/models/user');
const Book = require('../../db/models/book');

const cert = process.env.SECRET_KEY_BASE;

routes.post('/user', (req, res) => (
  sendJSON(res, { user: createUser() })
));

routes.post('/session', async (req, res) => {
  const { identifier } = req.body;
  const query = identifier == null ? createUser() : { identifier };
  const { user } = await User.firstOrCreate(query);
  const token = createToken({ identifier: user.identifier });
  sendJSON(res, { user, token });
});

routes.use((req, res, next) => {
  if (!req.token) {
    return res.status(403).json({
      success: false,
      message: 'No token provided.',
    });
  }

  try {
    req.user = getUserFromToken(req.token);
  } catch (err) {
    return res.json({
      success: false,
      message: 'Invalid token',
    })
  }

  next();
});

routes.post('/books', async (req, res) => {
  const { identifier } = req.user;
  const { asins } = req.body;
  await User.findOneAndUpdate({ identifier }, { asins });
  for (const asin of asins) {
    const { book, newRecord } = await Book.firstOrCreate({ _id: asin });
    if (newRecord) {
      exchange.publish({ asins: book.id }, { key: 'books.detail.get' });
    }
  }
  sendJSON(res, { success: true });
});

routes.post('/my', (req, res) => {
  const { identifier } = req.user;
  const { aid, apw } = req.body;
  const dataToken = jwt.sign(
    { identifier, aid, apw }, cert, { expiresIn: '1d' }
  );
  exchange.publish({ dataToken }, { key: 'books.purchased.get' });
  sendJSON(res, { success: true, queue: true });
});

module.exports = routes;

const createUser = () => ({
  identifier: uuid(),
});

const createToken = user => jwt.sign(user, cert, { expiresIn: '10y' });

const getUserFromToken = token => jwt.verify(token, cert);
