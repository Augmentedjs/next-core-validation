const ERROR_CODES = {
  INVALID_TYPE: 0,
  ENUM_MISMATCH: 1,
  ANY_OF_MISSING: 10,
  ONE_OF_MISSING: 11,
  ONE_OF_MULTIPLE: 12,
  NOT_PASSED: 13,
  // Numeric errors
  NUMBER_MULTIPLE_OF: 100,
  NUMBER_MINIMUM: 101,
  NUMBER_MINIMUM_EXCLUSIVE: 102,
  NUMBER_MAXIMUM: 103,
  NUMBER_MAXIMUM_EXCLUSIVE: 104,
  NUMBER_NOT_A_NUMBER: 105,
  // String errors
  STRING_LENGTH_SHORT: 200,
  STRING_LENGTH_LONG: 201,
  STRING_PATTERN: 202,
  // Object errors
  OBJECT_PROPERTIES_MINIMUM: 300,
  OBJECT_PROPERTIES_MAXIMUM: 301,
  OBJECT_REQUIRED: 302,
  OBJECT_ADDITIONAL_PROPERTIES: 303,
  OBJECT_DEPENDENCY_KEY: 304,
  // Array errors
  ARRAY_LENGTH_SHORT: 400,
  ARRAY_LENGTH_LONG: 401,
  ARRAY_UNIQUE: 402,
  ARRAY_ADDITIONAL_ITEMS: 403,
  // Custom/user-defined errors
  FORMAT_CUSTOM: 500,
  KEYWORD_CUSTOM: 501,
  // Schema structure
  CIRCULAR_REFERENCE: 600,
  // Non-standard validation options
  UNKNOWN_PROPERTY: 1000
};

// TODO: bundle this
const ERROR_MESSAGES_DEFAULT = {
  INVALID_TYPE: "Invalid type: {type} (expected {expected})",
  ENUM_MISMATCH: "No enum match for: {value}",
  ANY_OF_MISSING: "Data does not match any schemas from \"anyOf\"",
  ONE_OF_MISSING: "Data does not match any schemas from \"oneOf\"",
  ONE_OF_MULTIPLE: "Data is valid against more than one schema from \"oneOf\": indices {index1} and {index2}",
  NOT_PASSED: "Data matches schema from \"not\"",
  // Numeric errors
  NUMBER_MULTIPLE_OF: "Value {value} is not a multiple of {multipleOf}",
  NUMBER_MINIMUM: "Value {value} is less than minimum {minimum}",
  NUMBER_MINIMUM_EXCLUSIVE: "Value {value} is equal to exclusive minimum {minimum}",
  NUMBER_MAXIMUM: "Value {value} is greater than maximum {maximum}",
  NUMBER_MAXIMUM_EXCLUSIVE: "Value {value} is equal to exclusive maximum {maximum}",
  NUMBER_NOT_A_NUMBER: "Value {value} is not a valid number",
  // String errors
  STRING_LENGTH_SHORT: "String is too short ({length} chars), minimum {minimum}",
  STRING_LENGTH_LONG: "String is too long ({length} chars), maximum {maximum}",
  STRING_PATTERN: "String does not match pattern: {pattern}",
  // Object errors
  OBJECT_PROPERTIES_MINIMUM: "Too few properties defined ({propertyCount}), minimum {minimum}",
  OBJECT_PROPERTIES_MAXIMUM: "Too many properties defined ({propertyCount}), maximum {maximum}",
  OBJECT_REQUIRED: "Missing required property: {key}",
  OBJECT_ADDITIONAL_PROPERTIES: "Additional properties not allowed",
  OBJECT_DEPENDENCY_KEY: "Dependency failed - key must exist: {missing} (due to key: {key})",
  // Array errors
  ARRAY_LENGTH_SHORT: "Array is too short ({length}), minimum {minimum}",
  ARRAY_LENGTH_LONG: "Array is too long ({length}), maximum {maximum}",
  ARRAY_UNIQUE: "Array items are not unique (indices {match1} and {match2})",
  ARRAY_ADDITIONAL_ITEMS: "Additional items not allowed",
  // Format errors
  FORMAT_CUSTOM: "Format validation failed ({message})",
  KEYWORD_CUSTOM: "Keyword failed: {key} ({message})",
  // Schema structure
  CIRCULAR_REFERENCE: "Circular $refs: {urls}",
  // Non-standard validation options
  UNKNOWN_PROPERTY: "Unknown property (not in schema)"
};

class ValidationError { //extends Error {
  constructor(code, message, params, dataPath, schemaPath, subErrors) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    //super(code, message, params);
    //Error.call(this);
    if (code === undefined) {
      throw new Error ("No code supplied for error: "+ message);
    }
    this.message = message;
    this.params = params;
    this.code = code;
    this.dataPath = dataPath || "";
    this.schemaPath = schemaPath || "";
    this.subErrors = subErrors || null;

    const err = new Error(this.message);
    this.stack = err.stack || err.stacktrace;
    if (!this.stack) {
      try {
        throw err;
      } catch(err2) {
        this.stack = err2.stack || err2.stacktrace;
      }
    }
    this.name = "ValidationError";
  };

  prefixWith(dataPrefix, schemaPrefix) {
    if (dataPrefix !== null) {
      dataPrefix = dataPrefix.replace(/~/g, "~0").replace(/\//g, "~1");
      this.dataPath = "/" + dataPrefix + this.dataPath;
    }
    if (schemaPrefix !== null) {
      schemaPrefix = schemaPrefix.replace(/~/g, "~0").replace(/\//g, "~1");
      this.schemaPath = "/" + schemaPrefix + this.schemaPath;
    }
    if (this.subErrors !== null) {
      let i = 0, l = this.subErrors.length;
      for (i = 0; i < l; i++) {
        this.subErrors[i].prefixWith(dataPrefix, schemaPrefix);
      }
    }
    return this;
  };
};

let ErrorCodeLookup = {}, key;
for (key in ERROR_CODES) {
  ErrorCodeLookup[ERROR_CODES[key]] = key;
}

export { ERROR_CODES, ERROR_MESSAGES_DEFAULT, ValidationError, ErrorCodeLookup };
