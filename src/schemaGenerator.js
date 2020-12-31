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
const SchemaGenerator = (data, title = "model", description = "Generated Schema") => {
  const obj = SCHEMA_HEADER;
  if (data) {
    let i, d, dkey, p;
    const keys = Object.keys(data), l = keys.length;
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
    obj.title = title;
    obj.description = description;
  }
  return obj;
};

export default SchemaGenerator;
