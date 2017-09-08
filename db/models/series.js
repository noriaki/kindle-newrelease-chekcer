const { Schema } = require('mongoose');

const generateId = require('../../lib/id');
const connection = require('../').createConnection();

const seriesSchema = new Schema({
  _id: {
    type: String,
    index: true,
    unique: true,
    required: true,
    default: generateId,
  },
  title: {
    type: String,
    index: true,
  },
  author: {
    type: String,
    index: true,
  },
  asins: {
    type: [String],
    default: [],
  },
}, {
  timestamps: true,
});

class SeriesClass {
  static async firstOrCreate(query, doc = query) {
    const series = await this.findOne(query);
    if (series) { return { series, newRecord: false }; }
    return { series: await this.create(doc), newRecord: true };
  }

  addAsinIfNotIncludes(asin) {
    if (!this.asins.includes(asin)) { this.asins.push(asin); }
    return this;
  }
}
seriesSchema.loadClass(SeriesClass);

const Series = connection.model('Series', seriesSchema);
Series.shcema = seriesSchema;

module.exports = Series;