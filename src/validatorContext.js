import { ValidationError, ERROR_CODES, ERROR_MESSAGES_DEFAULT } from "./validationError.js";
import { normSchema, getDocumentUri } from "./functions.js";

let CLOSE_ENOUGH_LOW = Math.pow(2, -51);
let CLOSE_ENOUGH_HIGH = 1 - CLOSE_ENOUGH_LOW;

class ValidatorContext {
  constructor(parent, collectMultiple, errorMessages, checkRecursive, trackUnknownProperties) {
    this.missing = [];
    this.missingMap = {};
    this.formatValidators = parent ? Object.create(parent.formatValidators) : {};
    this.schemas = parent ? Object.create(parent.schemas) : {};
    this.collectMultiple = collectMultiple;
    this.errors = [];
    this.handleError = collectMultiple ? this.collectError : this.returnError;
    if (checkRecursive) {
      this.checkRecursive = true;
      this.scanned = [];
      this.scannedFrozen = [];
      this.scannedFrozenSchemas = [];
      this.scannedFrozenValidationErrors = [];
      this.validatedSchemasKey = 'tv4_validation_id';
      this.validationErrorsKey = 'tv4_validation_errors_id';
    }
    if (trackUnknownProperties) {
      this.trackUnknownProperties = true;
      this.knownPropertyPaths = {};
      this.unknownPropertyPaths = {};
    }
    this.errorMessages = errorMessages;
    this.definedKeywords = {};
    if (parent) {
      for (let key in parent.definedKeywords) {
        this.definedKeywords[key] = parent.definedKeywords[key].slice(0);
      }
    }
  };

  notReallyPercentEncode(string) {
    return encodeURI(string).replace(/%25[0-9][0-9]/g, (doubleEncoded) => {
      return "%" + doubleEncoded.substring(3);
    });
  };

  uriTemplateSubstitution(spec) {
    let modifier = "";
    if (URI_TEMPLATE_GLOBAL_MODIFIERS[spec.charAt(0)]) {
      modifier = spec.charAt(0);
      spec = spec.substring(1);
    }
    let separator = "";
    let prefix = "";
    let shouldEscape = true;
    let showVariables = false;
    let trimEmptyString = false;
    if (modifier === '+') {
      shouldEscape = false;
    } else if (modifier === ".") {
      prefix = ".";
      separator = ".";
    } else if (modifier === "/") {
      prefix = "/";
      separator = "/";
    } else if (modifier === '#') {
      prefix = "#";
      shouldEscape = false;
    } else if (modifier === ';') {
      prefix = ";";
      separator = ";";
      showVariables = true;
      trimEmptyString = true;
    } else if (modifier === '?') {
      prefix = "?";
      separator = "&";
      showVariables = true;
    } else if (modifier === '&') {
      prefix = "&";
      separator = "&";
      showVariables = true;
    }

    let varNames = [];
    let varList = spec.split(",");
    let varSpecs = [];
    let varSpecMap = {};
    let i = 0, l = varList.length;
    for (i = 0; i < l; i++) {
      let varName = varList[i];
      let truncate = null;
      if (varName.indexOf(":") !== -1) {
        let parts = varName.split(":");
        varName = parts[0];
        truncate = parseInt(parts[1], 10);
      }
      let suffices = {};
      while (URI_TEMPLATE_SUFFICES[varName.charAt(varName.length - 1)]) {
        suffices[varName.charAt(varName.length - 1)] = true;
        varName = varName.substring(0, varName.length - 1);
      }
      let varSpec = {
        truncate: truncate,
        name: varName,
        suffices: suffices
      };
      varSpecs.push(varSpec);
      varSpecMap[varName] = varSpec;
      varNames.push(varName);
    }

    const subFunction = (valueFunction) => {
      let result = "";
      let startIndex = 0;
      let i = 0, l = varSpecs.length;
      for (i = 0; i < l; i++) {
        let varSpec = varSpecs[i];

        if (!valueFunction && !isFunction(valueFunction)) {
          throw new Error("Problem qith value function.");
        }

        let value = valueFunction(varSpec.name);
        if (value === null || value === undefined || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && Object.keys(value).length === 0)) {
          startIndex++;
          continue;
        }
        if (i === startIndex) {
          result += prefix;
        } else {
          result += (separator || ",");
        }
        if (Array.isArray(value)) {
          if (showVariables) {
            result += varSpec.name + "=";
          }
          let j = 0;
          l = value.length;
          for (j = 0; j < l; j++) {
            if (j > 0) {
              result += varSpec.suffices['*'] ? (separator || ",") : ",";
              if (varSpec.suffices['*'] && showVariables) {
                result += varSpec.name + "=";
              }
            }
            result += shouldEscape ? encodeURIComponent(value[j]).replace(/!/g, "%21") : this.notReallyPercentEncode(value[j]);
          }
        } else if (typeof value === "object") {
          if (showVariables && !varSpec.suffices['*']) {
            result += varSpec.name + "=";
          }
          let first = true;
          for (let key in value) {
            if (!first) {
              result += varSpec.suffices['*'] ? (separator || ",") : ",";
            }
            first = false;
            result += shouldEscape ? encodeURIComponent(key).replace(/!/g, "%21") : this.notReallyPercentEncode(key);
            result += varSpec.suffices['*'] ? '=' : ",";
            result += shouldEscape ? encodeURIComponent(value[key]).replace(/!/g, "%21") : this.notReallyPercentEncode(value[key]);
          }
        } else {
          if (showVariables) {
            result += varSpec.name;
            if (!trimEmptyString || value !== "") {
              result += "=";
            }
          }
          if (varSpec.truncate !== null) {
            value = value.substring(0, varSpec.truncate);
          }
          result += shouldEscape ? encodeURIComponent(value).replace(/!/g, "%21"): this.notReallyPercentEncode(value);
        }
      }
      return result;
    };
    subFunction.varNames = varNames;
    return {
      prefix: prefix,
      substitution: subFunction
    };
  };

  recursiveCompare(A, B) {
    if (A === B) {
      return true;
    }
    if (typeof A === "object" && typeof B === "object") {
      if (Array.isArray(A) !== Array.isArray(B)) {
        return false;
      } else if (Array.isArray(A)) {
        if (A.length !== B.length) {
          return false;
        }
        let i = 0, l = A.length;
        for (i = 0; i < l; i++) {
          if (!this.recursiveCompare(A[i], B[i])) {
            return false;
          }
        }
      } else {
        let key;
        for (key in A) {
          if (B[key] === undefined && A[key] !== undefined) {
            return false;
          }
        }
        for (key in B) {
          if (A[key] === undefined && B[key] !== undefined) {
            return false;
          }
        }
        for (key in A) {
          if (!this.recursiveCompare(A[key], B[key])) {
            return false;
          }
        }
      }
      return true;
    }
    return false;
  };

  defineKeyword(keyword, keywordFunction) {
    this.definedKeywords[keyword] = this.definedKeywords[keyword] || [];
    this.definedKeywords[keyword].push(keywordFunction);
  };

  createError(code, messageParams, dataPath, schemaPath, subErrors) {
    let messageTemplate = this.errorMessages[code] || ERROR_MESSAGES_DEFAULT[code];
    if (typeof messageTemplate !== 'string') {
      return new ValidationError(code, "Unknown error code " + code + ": " + JSON.stringify(messageParams), messageParams, dataPath, schemaPath, subErrors);
    }
    // Adapted from Crockford's supplant()
    let message = messageTemplate.replace(/\{([^{}]*)\}/g, function (whole, varName) {
      let subValue = messageParams[varName];
      return typeof subValue === 'string' || typeof subValue === 'number' ? subValue : whole;
    });
    return new ValidationError(code, message, messageParams, dataPath, schemaPath, subErrors);
  };
  returnError(error) {
    return error;
  };

  collectError(error) {
    if (error) {
      this.errors.push(error);
    }
    return null;
  };

  prefixErrors(startIndex, dataPath, schemaPath) {
    let i = 0, l = this.errors.length;
    for (i = startIndex; i < l; i++) {
      this.errors[i] = this.errors[i].prefixWith(dataPath, schemaPath);
    }
    return this;
  };

  banUnknownProperties() {
    for (let unknownPath in this.unknownPropertyPaths) {
      let error = this.createError(ERROR_CODES.UNKNOWN_PROPERTY, {path: unknownPath}, unknownPath, "");
      let result = this.handleError(error);
      if (result) {
        return result;
      }
    }
    return null;
  };
  addFormat(format, validator) {
    if (typeof format === 'object') {
      for (let key in format) {
        this.addFormat(key, format[key]);
      }
      return this;
    }
    this.formatValidators[format] = validator;
  };
  resolveRefs(schema, urlHistory) {
    if (schema['$ref'] !== undefined) {
      urlHistory = urlHistory || {};
      if (urlHistory[schema['$ref']]) {
        return this.createError(ERROR_CODES.CIRCULAR_REFERENCE, {urls: Object.keys(urlHistory).join(', ')}, '', '');
      }
      urlHistory[schema['$ref']] = true;
      schema = this.getSchema(schema['$ref'], urlHistory);
    }
    return schema;
  };
  getSchema(url, urlHistory) {
    let schema;
    if (this.schemas[url] !== undefined) {
      schema = this.schemas[url];
      return this.resolveRefs(schema, urlHistory);
    }
    let baseUrl = url;
    let fragment = "";
    if (url.indexOf('#') !== -1) {
      fragment = url.substring(url.indexOf("#") + 1);
      baseUrl = url.substring(0, url.indexOf("#"));
    }
    if (typeof this.schemas[baseUrl] === 'object') {
      schema = this.schemas[baseUrl];
      let pointerPath = decodeURIComponent(fragment);
      if (pointerPath === "") {
        return this.resolveRefs(schema, urlHistory);
      } else if (pointerPath.charAt(0) !== "/") {
        return undefined;
      }
      let parts = pointerPath.split("/").slice(1);
      let i = 0, l = parts.length;
      for (i = 0; i < l; i++) {
        let component = parts[i].replace(/~1/g, "/").replace(/~0/g, "~");
        if (schema[component] === undefined) {
          schema = undefined;
          break;
        }
        schema = schema[component];
      }
      if (schema !== undefined) {
        return this.resolveRefs(schema, urlHistory);
      }
    }
    if (this.missing[baseUrl] === undefined) {
      this.missing.push(baseUrl);
      this.missing[baseUrl] = baseUrl;
      this.missingMap[baseUrl] = baseUrl;
    }
  };
  searchSchemas(schema, url) {
    if (Array.isArray(schema)) {
      let i = 0, l = schema.length;
      for (i = 0; i < l; i++) {
        this.searchSchemas(schema[i], url);
      }
    } else if (schema && typeof schema === "object") {
      if (typeof schema.id === "string") {
        if (isTrustedUrl(url, schema.id)) {
          if (this.schemas[schema.id] === undefined) {
            this.schemas[schema.id] = schema;
          }
        }
      }
      for (let key in schema) {
        if (key !== "enum") {
          if (typeof schema[key] === "object") {
            this.searchSchemas(schema[key], url);
          } else if (key === "$ref") {
            let uri = getDocumentUri(schema[key]);
            if (uri && this.schemas[uri] === undefined && this.missingMap[uri] === undefined) {
              this.missingMap[uri] = uri;
            }
          }
        }
      }
    }
  };
  addSchema(url, schema) {
    // overload
    if (typeof url !== 'string' || typeof schema === 'undefined') {
      if (typeof url === 'object' && typeof url.id === 'string') {
        schema = url;
        url = schema.id;
      } else {
        return;
      }
    }
    if (url === getDocumentUri(url) + "#") {
      // Remove empty fragment
      url = getDocumentUri(url);
    }
    this.schemas[url] = schema;
    delete this.missingMap[url];
    normSchema(schema, url);
    this.searchSchemas(schema, url);
  };

  getSchemaMap() {
    let map = {};
    for (let key in this.schemas) {
      map[key] = this.schemas[key];
    }
    return map;
  };

  getSchemaUris(filterRegExp) {
    let list = [];
    for (let key in this.schemas) {
      if (!filterRegExp || filterRegExp.test(key)) {
        list.push(key);
      }
    }
    return list;
  };

  getMissingUris(filterRegExp) {
    let list = [];
    for (let key in this.missingMap) {
      if (!filterRegExp || filterRegExp.test(key)) {
        list.push(key);
      }
    }
    return list;
  };

  dropSchemas() {
    this.schemas = {};
    this.reset();
  };

  reset() {
    this.missing = [];
    this.missingMap = {};
    this.errors = [];
  };

  validateAll(data, schema, dataPathParts, schemaPathParts, dataPointerPath) {
    let topLevel;
    schema = this.resolveRefs(schema);

    if (!schema) {
      return null;
    } else if (schema instanceof ValidationError) {
      this.errors.push(schema);
      return schema;
    }

    let startErrorCount = this.errors.length;
    let frozenIndex, scannedFrozenSchemaIndex = null, scannedSchemasIndex = null;
    if (this.checkRecursive && data && typeof data === 'object') {
      topLevel = !this.scanned.length;
      if (data[this.validatedSchemasKey]) {
        let schemaIndex = data[this.validatedSchemasKey].indexOf(schema);
        if (schemaIndex !== -1) {
          this.errors = this.errors.concat(data[this.validationErrorsKey][schemaIndex]);
          return null;
        }
      }
      if (Object.isFrozen(data)) {
        frozenIndex = this.scannedFrozen.indexOf(data);
        if (frozenIndex !== -1) {
          let frozenSchemaIndex = this.scannedFrozenSchemas[frozenIndex].indexOf(schema);
          if (frozenSchemaIndex !== -1) {
            this.errors = this.errors.concat(this.scannedFrozenValidationErrors[frozenIndex][frozenSchemaIndex]);
            return null;
          }
        }
      }
      this.scanned.push(data);
      if (Object.isFrozen(data)) {
        if (frozenIndex === -1) {
          frozenIndex = this.scannedFrozen.length;
          this.scannedFrozen.push(data);
          this.scannedFrozenSchemas.push([]);
        }
        scannedFrozenSchemaIndex = this.scannedFrozenSchemas[frozenIndex].length;
        this.scannedFrozenSchemas[frozenIndex][scannedFrozenSchemaIndex] = schema;
        this.scannedFrozenValidationErrors[frozenIndex][scannedFrozenSchemaIndex] = [];
      } else {
        if (!data[this.validatedSchemasKey]) {
          try {
            Object.defineProperty(data, this.validatedSchemasKey, {
              value: [],
              configurable: true
            });
            Object.defineProperty(data, this.validationErrorsKey, {
              value: [],
              configurable: true
            });
          } catch (e) {
            // IE 7/8 workaround
            data[this.validatedSchemasKey] = [];
            data[this.validationErrorsKey] = [];
          }
        }
        scannedSchemasIndex = data[this.validatedSchemasKey].length;
        data[this.validatedSchemasKey][scannedSchemasIndex] = schema;
        data[this.validationErrorsKey][scannedSchemasIndex] = [];
      }
    }

    let errorCount = this.errors.length;
    let error = this.validateBasic(data, schema, dataPointerPath) || this.validateNumeric(data, schema, dataPointerPath) || this.validateString(data, schema, dataPointerPath) || this.validateArray(data, schema, dataPointerPath) || this.validateObject(data, schema, dataPointerPath) || this.validateCombinations(data, schema, dataPointerPath) || this.validateHypermedia(data, schema, dataPointerPath) || this.validateFormat(data, schema, dataPointerPath) || this.validateDefinedKeywords(data, schema, dataPointerPath) || null;

    if (topLevel) {
      while (this.scanned.length) {
        let item = this.scanned.pop();
        delete item[this.validatedSchemasKey];
      }
      this.scannedFrozen = [];
      this.scannedFrozenSchemas = [];
    }

    if (error || errorCount !== this.errors.length) {
      while ((dataPathParts && dataPathParts.length) || (schemaPathParts && schemaPathParts.length)) {
        let dataPart = (dataPathParts && dataPathParts.length) ? "" + dataPathParts.pop() : null;
        let schemaPart = (schemaPathParts && schemaPathParts.length) ? "" + schemaPathParts.pop() : null;
        if (error) {
          error = error.prefixWith(dataPart, schemaPart);
        }
        this.prefixErrors(errorCount, dataPart, schemaPart);
      }
    }

    if (scannedFrozenSchemaIndex !== null) {
      this.scannedFrozenValidationErrors[frozenIndex][scannedFrozenSchemaIndex] = this.errors.slice(startErrorCount);
    } else if (scannedSchemasIndex !== null) {
      data[this.validationErrorsKey][scannedSchemasIndex] = this.errors.slice(startErrorCount);
    }

    return this.handleError(error);
  };

  validateFormat(data, schema) {
    if (typeof schema.format !== 'string' || !this.formatValidators[schema.format]) {
      return null;
    }
    let errorMessage = this.formatValidators[schema.format].call(null, data, schema);
    if (typeof errorMessage === 'string' || typeof errorMessage === 'number') {
      return this.createError(ERROR_CODES.FORMAT_CUSTOM, {message: errorMessage}).prefixWith(null, "format");
    } else if (errorMessage && typeof errorMessage === 'object') {
      return this.createError(ERROR_CODES.FORMAT_CUSTOM, {message: errorMessage.message || "?"}, errorMessage.dataPath || null, errorMessage.schemaPath || "/format");
    }
    return null;
  };

  validateDefinedKeywords(data, schema, dataPointerPath) {
    for (let key in this.definedKeywords) {
      if (typeof schema[key] === 'undefined') {
        continue;
      }
      let validationFunctions = this.definedKeywords[key];
      let i = 0, l = validationFunctions.length;
      for (i = 0; i < l; i++) {
        let func = validationFunctions[i];
        let result = func(data, schema[key], schema, dataPointerPath);
        if (typeof result === 'string' || typeof result === 'number') {
          return this.createError(ERROR_CODES.KEYWORD_CUSTOM, {key: key, message: result}).prefixWith(null, "format");
        } else if (result && typeof result === 'object') {
          let code = result.code;
          if (typeof code === 'string') {
            if (!ERROR_CODES[code]) {
              throw new Error('Undefined error code (use defineError): ' + code);
            }
            code = ERROR_CODES[code];
          } else if (typeof code !== 'number') {
            code = ERROR_CODES.KEYWORD_CUSTOM;
          }
          let messageParams = (typeof result.message === 'object') ? result.message : {key: key, message: result.message || "?"};
          let schemaPath = result.schemaPath ||( "/" + key.replace(/~/g, '~0').replace(/\//g, '~1'));
          return this.createError(code, messageParams, result.dataPath || null, schemaPath);
        }
      }
    }
    return null;
  };

  validateBasic(data, schema, dataPointerPath) {
    let error = this.validateType(data, schema, dataPointerPath);
    if (error) {
      return error.prefixWith(null, "type");
    }
      /*if (error = this.validateEnum(data, schema, dataPointerPath)) {
      return error.prefixWith(null, "type");
    }*/
    return null;
  };

  validateType(data, schema) {
    if (schema.type === undefined) {
      return null;
    }
    let dataType = typeof data;
    if (data === null) {
      dataType = "null";
    } else if (Array.isArray(data)) {
      dataType = "array";
    }
    let allowedTypes = schema.type;
    if (typeof allowedTypes !== "object") {
      allowedTypes = [allowedTypes];
    }

    let i = 0, l = allowedTypes.length;
    for (i = 0; i < l; i++) {
      let type = allowedTypes[i];
      if (type === dataType || (type === "integer" && dataType === "number" && (data % 1 === 0))) {
        return null;
      }
    }
    return this.createError(ERROR_CODES.INVALID_TYPE, {type: dataType, expected: allowedTypes.join("/")});
  };

  validateEnum(data, schema) {
    if (schema["enum"] === undefined) {
      return null;
    }
    let i = 0, l = schema["enum"].length;
    for (i = 0; i < l; i++) {
      let enumVal = schema["enum"][i];
      if (this.recursiveCompare(data, enumVal)) {
        return null;
      }
    }
    return this.createError(ERROR_CODES.ENUM_MISMATCH, {value: (typeof JSON !== 'undefined') ? JSON.stringify(data) : data});
  };

  validateNumeric(data, schema, dataPointerPath) {
    return this.validateMultipleOf(data, schema, dataPointerPath) || this.validateMinMax(data, schema, dataPointerPath) || this.validateNaN(data, schema, dataPointerPath) || null;
  };

  validateMultipleOf(data, schema) {
    let multipleOf = schema.multipleOf || schema.divisibleBy;
    if (multipleOf === undefined) {
      return null;
    }
    if (typeof data === "number") {
      let remainder = (data/multipleOf)%1;
      if (remainder >= CLOSE_ENOUGH_LOW && remainder < CLOSE_ENOUGH_HIGH) {
        return this.createError(ERROR_CODES.NUMBER_MULTIPLE_OF, {value: data, multipleOf: multipleOf});
      }
    }
    return null;
  };

  validateMinMax(data, schema) {
    if (typeof data !== "number") {
      return null;
    }
    if (schema.minimum !== undefined) {
      if (data < schema.minimum) {
        return this.createError(ERROR_CODES.NUMBER_MINIMUM, {value: data, minimum: schema.minimum}).prefixWith(null, "minimum");
      }
      if (schema.exclusiveMinimum && data === schema.minimum) {
        return this.createError(ERROR_CODES.NUMBER_MINIMUM_EXCLUSIVE, {value: data, minimum: schema.minimum}).prefixWith(null, "exclusiveMinimum");
      }
    }
    if (schema.maximum !== undefined) {
      if (data > schema.maximum) {
        return this.createError(ERROR_CODES.NUMBER_MAXIMUM, {value: data, maximum: schema.maximum}).prefixWith(null, "maximum");
      }
      if (schema.exclusiveMaximum && data === schema.maximum) {
        return this.createError(ERROR_CODES.NUMBER_MAXIMUM_EXCLUSIVE, {value: data, maximum: schema.maximum}).prefixWith(null, "exclusiveMaximum");
      }
    }
    return null;
  };

  validateNaN(data) {
    if (typeof data !== "number") {
      return null;
    }
    if (isNaN(data) === true || data === Infinity || data === -Infinity) {
      return this.createError(ERROR_CODES.NUMBER_NOT_A_NUMBER, {value: data}).prefixWith(null, "type");
    }
    return null;
  };

  validateString(data, schema, dataPointerPath) {
    return this.validateStringLength(data, schema, dataPointerPath) || this.validateStringPattern(data, schema, dataPointerPath) || null;
  };

  validateStringLength(data, schema) {
    if (typeof data !== "string") {
      return null;
    }
    if (schema.minLength !== undefined) {
      if (data.length < schema.minLength) {
        return this.createError(ERROR_CODES.STRING_LENGTH_SHORT, {length: data.length, minimum: schema.minLength}).prefixWith(null, "minLength");
      }
    }
    if (schema.maxLength !== undefined) {
      if (data.length > schema.maxLength) {
        return this.createError(ERROR_CODES.STRING_LENGTH_LONG, {length: data.length, maximum: schema.maxLength}).prefixWith(null, "maxLength");
      }
    }
    return null;
  };

  validateStringPattern(data, schema) {
    if (typeof data !== "string" || schema.pattern === undefined) {
      return null;
    }
    let regexp = new RegExp(schema.pattern);
    if (!regexp.test(data)) {
      return this.createError(ERROR_CODES.STRING_PATTERN, {pattern: schema.pattern}).prefixWith(null, "pattern");
    }
    return null;
  };
  validateArray(data, schema, dataPointerPath) {
    if (!Array.isArray(data)) {
      return null;
    }
    return this.validateArrayLength(data, schema, dataPointerPath) || this.validateArrayUniqueItems(data, schema, dataPointerPath) || this.validateArrayItems(data, schema, dataPointerPath) || null;
  };

  validateArrayLength(data, schema) {
    let error;
    if (schema.minItems !== undefined) {
      if (data.length < schema.minItems) {
        error = (this.createError(ERROR_CODES.ARRAY_LENGTH_SHORT, {length: data.length, minimum: schema.minItems})).prefixWith(null, "minItems");
        if (this.handleError(error)) {
          return error;
        }
      }
    }
    if (schema.maxItems !== undefined) {
      if (data.length > schema.maxItems) {
        error = (this.createError(ERROR_CODES.ARRAY_LENGTH_LONG, {length: data.length, maximum: schema.maxItems})).prefixWith(null, "maxItems");
        if (this.handleError(error)) {
          return error;
        }
      }
    }
    return null;
  };

  validateArrayUniqueItems(data, schema) {
    if (schema.uniqueItems) {
      let i = 0, l = data.length;
      for (i = 0; i < l; i++) {
        let j = 0;
        for (j = i + 1; j < l; j++) {
          if (recursiveCompare(data[i], data[j])) {
            let error = (this.createError(ERROR_CODES.ARRAY_UNIQUE, {match1: i, match2: j})).prefixWith(null, "uniqueItems");
            if (this.handleError(error)) {
              return error;
            }
          }
        }
      }
    }
    return null;
  };

  validateArrayItems(data, schema, dataPointerPath) {
    if (schema.items === undefined) {
      return null;
    }
    let error, i;
    if (Array.isArray(schema.items)) {
      let l = data.length;
      for (i = 0; i < l; i++) {
        if (i < schema.items.length) {
          if (error = this.validateAll(data[i], schema.items[i], [i], ["items", i], dataPointerPath + "/" + i)) {
            return error;
          }
        } else if (schema.additionalItems !== undefined) {
          if (typeof schema.additionalItems === "boolean") {
            if (!schema.additionalItems) {
              error = (this.createError(ERROR_CODES.ARRAY_ADDITIONAL_ITEMS, {})).prefixWith("" + i, "additionalItems");
              if (this.handleError(error)) {
                return error;
              }
            }
          } else if (error = this.validateAll(data[i], schema.additionalItems, [i], ["additionalItems"], dataPointerPath + "/" + i)) {
            return error;
          }
        }
      }
    } else {
      let l = data.length;
      for (i = 0; i < l; i++) {
        if (error = this.validateAll(data[i], schema.items, [i], ["items"], dataPointerPath + "/" + i)) {
          return error;
        }
      }
    }
    return null;
  };

  validateObject(data, schema, dataPointerPath) {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return null;
    }
    return this.validateObjectMinMaxProperties(data, schema, dataPointerPath) || this.validateObjectRequiredProperties(data, schema, dataPointerPath) || this.validateObjectProperties(data, schema, dataPointerPath) || this.validateObjectDependencies(data, schema, dataPointerPath) || null;
  };

  validateObjectMinMaxProperties(data, schema) {
    let keys = Object.keys(data);
    let error;
    if (schema.minProperties !== undefined) {
      if (keys.length < schema.minProperties) {
        error = this.createError(ERROR_CODES.OBJECT_PROPERTIES_MINIMUM, {propertyCount: keys.length, minimum: schema.minProperties}).prefixWith(null, "minProperties");
        if (this.handleError(error)) {
          return error;
        }
      }
    }
    if (schema.maxProperties !== undefined) {
      if (keys.length > schema.maxProperties) {
        error = this.createError(ERROR_CODES.OBJECT_PROPERTIES_MAXIMUM, {propertyCount: keys.length, maximum: schema.maxProperties}).prefixWith(null, "maxProperties");
        if (this.handleError(error)) {
          return error;
        }
      }
    }
    return null;
  };

  validateObjectRequiredProperties(data, schema) {
    if (schema.required !== undefined) {
      let i = 0, l = schema.required.length;
      for (i = 0; i < l; i++) {
        let key = schema.required[i];
        if (data[key] === undefined) {
          let error = this.createError(ERROR_CODES.OBJECT_REQUIRED, {key: key}).prefixWith(null, "" + i).prefixWith(null, "required");
          if (this.handleError(error)) {
            return error;
          }
        }
      }
    }
    return null;
  };

  validateObjectProperties(data, schema, dataPointerPath) {
    let error;
    for (let key in data) {
      let keyPointerPath = dataPointerPath + "/" + key.replace(/~/g, '~0').replace(/\//g, '~1');
      let foundMatch = false;
      if (schema.properties !== undefined && schema.properties[key] !== undefined) {
        foundMatch = true;
        if (error = this.validateAll(data[key], schema.properties[key], [key], ["properties", key], keyPointerPath)) {
          return error;
        }
      }
      if (schema.patternProperties !== undefined) {
        for (let patternKey in schema.patternProperties) {
          let regexp = new RegExp(patternKey);
          if (regexp.test(key)) {
            foundMatch = true;
            if (error = this.validateAll(data[key], schema.patternProperties[patternKey], [key], ["patternProperties", patternKey], keyPointerPath)) {
              return error;
            }
          }
        }
      }
      if (!foundMatch) {
        if (schema.additionalProperties !== undefined) {
          if (this.trackUnknownProperties) {
            this.knownPropertyPaths[keyPointerPath] = true;
            delete this.unknownPropertyPaths[keyPointerPath];
          }
          if (typeof schema.additionalProperties === "boolean") {
            if (!schema.additionalProperties) {
              error = this.createError(ERROR_CODES.OBJECT_ADDITIONAL_PROPERTIES, {}).prefixWith(key, "additionalProperties");
              if (this.handleError(error)) {
                return error;
              }
            }
          } else {
            if (error = this.validateAll(data[key], schema.additionalProperties, [key], ["additionalProperties"], keyPointerPath)) {
              return error;
            }
          }
        } else if (this.trackUnknownProperties && !this.knownPropertyPaths[keyPointerPath]) {
          this.unknownPropertyPaths[keyPointerPath] = true;
        }
      } else if (this.trackUnknownProperties) {
        this.knownPropertyPaths[keyPointerPath] = true;
        delete this.unknownPropertyPaths[keyPointerPath];
      }
    }
    return null;
  };

  validateObjectDependencies(data, schema, dataPointerPath) {
    let error;
    if (schema.dependencies !== undefined) {
      for (let depKey in schema.dependencies) {
        if (data[depKey] !== undefined) {
          let dep = schema.dependencies[depKey];
          if (typeof dep === "string") {
            if (data[dep] === undefined) {
              error = this.createError(ERROR_CODES.OBJECT_DEPENDENCY_KEY, {key: depKey, missing: dep}).prefixWith(null, depKey).prefixWith(null, "dependencies");
              if (this.handleError(error)) {
                return error;
              }
            }
          } else if (Array.isArray(dep)) {
            let i = 0, l = dep.lenth;
            for (i = 0; i < l; i++) {
              let requiredKey = dep[i];
              if (data[requiredKey] === undefined) {
                error = this.createError(ERROR_CODES.OBJECT_DEPENDENCY_KEY, {key: depKey, missing: requiredKey}).prefixWith(null, "" + i).prefixWith(null, depKey).prefixWith(null, "dependencies");
                if (this.handleError(error)) {
                  return error;
                }
              }
            }
          } else {
            if (error = this.validateAll(data, dep, [], ["dependencies", depKey], dataPointerPath)) {
              return error;
            }
          }
        }
      }
    }
    return null;
  };

  validateCombinations(data, schema, dataPointerPath) {
    return this.validateAllOf(data, schema, dataPointerPath) || this.validateAnyOf(data, schema, dataPointerPath) || this.validateOneOf(data, schema, dataPointerPath) || this.validateNot(data, schema, dataPointerPath) || null;
  };

  validateAllOf(data, schema, dataPointerPath) {
    if (schema.allOf === undefined) {
      return null;
    }
    let error;
    let i = 0, l = schema.allOf.length;
    for (i = 0; i < l; i++) {
      let subSchema = schema.allOf[i];
      if (error = this.validateAll(data, subSchema, [], ["allOf", i], dataPointerPath)) {
        return error;
      }
    }
    return null;
  };

  validateAnyOf(data, schema, dataPointerPath) {
    if (schema.anyOf === undefined) {
      return null;
    }
    let errors = [];
    let startErrorCount = this.errors.length;
    let oldUnknownPropertyPaths, oldKnownPropertyPaths;
    if (this.trackUnknownProperties) {
      oldUnknownPropertyPaths = this.unknownPropertyPaths;
      oldKnownPropertyPaths = this.knownPropertyPaths;
    }
    let errorAtEnd = true;
    let i = 0, l = schema.anyOf.length;
    for (i = 0; i < l; i++) {
      if (this.trackUnknownProperties) {
        this.unknownPropertyPaths = {};
        this.knownPropertyPaths = {};
      }
      let subSchema = schema.anyOf[i];

      let errorCount = this.errors.length;
      let error = this.validateAll(data, subSchema, [], ["anyOf", i], dataPointerPath);

      if (error === null && errorCount === this.errors.length) {
        this.errors = this.errors.slice(0, startErrorCount);

        if (this.trackUnknownProperties) {
          for (let knownKey in this.knownPropertyPaths) {
            oldKnownPropertyPaths[knownKey] = true;
            delete oldUnknownPropertyPaths[knownKey];
          }
          for (let unknownKey in this.unknownPropertyPaths) {
            if (!oldKnownPropertyPaths[unknownKey]) {
              oldUnknownPropertyPaths[unknownKey] = true;
            }
          }
          // We need to continue looping so we catch all the
          // property definitions, but we don't want to return an
          // error
          errorAtEnd = false;
          continue;
        }

        return null;
      }
      if (error) {
        errors.push(error.prefixWith(null, "" + i).prefixWith(null, "anyOf"));
      }
    }
    if (this.trackUnknownProperties) {
      this.unknownPropertyPaths = oldUnknownPropertyPaths;
      this.knownPropertyPaths = oldKnownPropertyPaths;
    }
    if (errorAtEnd) {
      errors = errors.concat(this.errors.slice(startErrorCount));
      this.errors = this.errors.slice(0, startErrorCount);
      return this.createError(ERROR_CODES.ANY_OF_MISSING, {}, "", "/anyOf", errors);
    }
  };

  validateOneOf(data, schema, dataPointerPath) {
    if (schema.oneOf === undefined) {
      return null;
    }
    let validIndex = null;
    let errors = [];
    let startErrorCount = this.errors.length;
    let oldUnknownPropertyPaths, oldKnownPropertyPaths;
    if (this.trackUnknownProperties) {
      oldUnknownPropertyPaths = this.unknownPropertyPaths;
      oldKnownPropertyPaths = this.knownPropertyPaths;
    }
    let i = 0, l = schema.oneOf.length;
    for (i = 0; i < l; i++) {
      if (this.trackUnknownProperties) {
        this.unknownPropertyPaths = {};
        this.knownPropertyPaths = {};
      }
      let subSchema = schema.oneOf[i];

      let errorCount = this.errors.length;
      let error = this.validateAll(data, subSchema, [], ["oneOf", i], dataPointerPath);

      if (error === null && errorCount === this.errors.length) {
        if (validIndex === null) {
          validIndex = i;
        } else {
          this.errors = this.errors.slice(0, startErrorCount);
          return this.createError(ERROR_CODES.ONE_OF_MULTIPLE, {index1: validIndex, index2: i}, "", "/oneOf");
        }
        if (this.trackUnknownProperties) {
          for (let knownKey in this.knownPropertyPaths) {
            oldKnownPropertyPaths[knownKey] = true;
            delete oldUnknownPropertyPaths[knownKey];
          }
          for (let unknownKey in this.unknownPropertyPaths) {
            if (!oldKnownPropertyPaths[unknownKey]) {
              oldUnknownPropertyPaths[unknownKey] = true;
            }
          }
        }
      } else if (error) {
        errors.push(error);
      }
    }
    if (this.trackUnknownProperties) {
      this.unknownPropertyPaths = oldUnknownPropertyPaths;
      this.knownPropertyPaths = oldKnownPropertyPaths;
    }
    if (validIndex === null) {
      errors = errors.concat(this.errors.slice(startErrorCount));
      this.errors = this.errors.slice(0, startErrorCount);
      return this.createError(ERROR_CODES.ONE_OF_MISSING, {}, "", "/oneOf", errors);
    } else {
      this.errors = this.errors.slice(0, startErrorCount);
    }
    return null;
  };

  validateNot(data, schema, dataPointerPath) {
    if (schema.not === undefined) {
      return null;
    }
    let oldErrorCount = this.errors.length;
    let oldUnknownPropertyPaths, oldKnownPropertyPaths;
    if (this.trackUnknownProperties) {
      oldUnknownPropertyPaths = this.unknownPropertyPaths;
      oldKnownPropertyPaths = this.knownPropertyPaths;
      this.unknownPropertyPaths = {};
      this.knownPropertyPaths = {};
    }
    let error = this.validateAll(data, schema.not, null, null, dataPointerPath);
    let notErrors = this.errors.slice(oldErrorCount);
    this.errors = this.errors.slice(0, oldErrorCount);
    if (this.trackUnknownProperties) {
      this.unknownPropertyPaths = oldUnknownPropertyPaths;
      this.knownPropertyPaths = oldKnownPropertyPaths;
    }
    if (error === null && notErrors.length === 0) {
      return this.createError(ERROR_CODES.NOT_PASSED, {}, "", "/not");
    }
    return null;
  };

  validateHypermedia(data, schema, dataPointerPath) {
    if (!schema.links) {
      return null;
    }
    let error;
    let i = 0, l = schema.links.length;
    for (i = 0; i < l; i++) {
      let ldo = schema.links[i];
      if (ldo.rel === "describedby") {
        let template = new UriTemplate(ldo.href);
        let allPresent = true;
        let j = 0, ll = template.varNames.length;
        for (j = 0; j < ll; j++) {
          if (!(template.varNames[j] in data)) {
            allPresent = false;
            break;
          }
        }
        if (allPresent) {
          let schemaUrl = template.fillFromObject(data);
          let subSchema = {"$ref": schemaUrl};
          if (error = this.validateAll(data, subSchema, [], ["links", i], dataPointerPath)) {
            return error;
          }
        }
      }
    }
  };
};

export default ValidatorContext = ValidatorContext;
