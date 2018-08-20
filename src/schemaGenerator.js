const SCHEMA_HEADER = {
  "$schema": "http://json-schema.org/draft-04/schema#",
  "title": "model",
  "description": "Generated Schema",
  "type": "object",
  "properties": { }
};

/**
 * <p>Augmented.Utility.SchemaGenerator<br/>
 *
 * Genrate a schema from a set of data</p>
 * @param {object} data a dataset to produce a schema from
 * @memberof Utility
 */
const SchemaGenerator = (data) => {
  let obj = SCHEMA_HEADER;
  let i, d, dkey, p, keys = Object.keys(data), l = keys.length;
  for (i = 0; i < l; i++) {
    d = keys[i];
    for (dkey in d) {
      if (d.hasOwnProperty(dkey)) {
        p = obj.properties[d] = {};

        let t = (typeof data[d]);
        if (t === "object") {
          t = (Array.isArray(data[d])) ? "array" : "object";
        } else if (t === "number") {
          t = (Number.isInteger(data[d])) ? "integer" : "number";
        }
        p.type = t;
        p.description = String(d);
      }
    }
  }
  return obj;
};

export default SchemaGenerator;
