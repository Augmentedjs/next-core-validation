import ValidatorContext from "./validatorContext.js";
import { ErrorCodeLookup, ERROR_CODES, ERROR_MESSAGES_DEFAULT } from "./validationError.js";
import { normSchema, resolveUrl, getDocumentUri } from "./functions.js";

let languages = {};

const createApi = (language) => {
  const _myContext = new ValidatorContext();
  let currentLanguage = language || 'en';

  const api = {
    addFormat: (format, validator) => {
      _myContext.addFormat(format, validator);
    },
    language: (code) => {
      if (!code) {
        return currentLanguage;
      }
      if (!languages[code]) {
        code = code.split('-')[0]; // fall back to base
        // language
      }
      if (languages[code]) {
        currentLanguage = code;
        return code; // so you can tell if fall-back has happened
      }
      return false;
    },
    addLanguage: (code, messageMap) => {
      let key;
      for (key in ERROR_CODES) {
        if (messageMap[key] && !messageMap[ERROR_CODES[key]]) {
          messageMap[ERROR_CODES[key]] = messageMap[key];
        }
      }
      let rootCode = code.split('-')[0];
      if (!languages[rootCode]) { // use for base language if
        // not yet defined
        languages[code] = messageMap;
        languages[rootCode] = messageMap;
      } else {
        languages[code] = Object.create(languages[rootCode]);
        for (key in messageMap) {
          if (typeof languages[rootCode][key] === 'undefined') {
            languages[rootCode][key] = messageMap[key];
          }
          languages[code][key] = messageMap[key];
        }
      }
      return this;
    },
    freshApi: (language) => {
      const result = createApi();
      if (language) {
        result.language(language);
      }
      return result;
    },
    validate: (data, schema, checkRecursive, banUnknownProperties) => {
      const context = new ValidatorContext(_myContext, false, languages[currentLanguage], checkRecursive, banUnknownProperties);
      if (typeof schema === "string") {
        schema = {"$ref": schema};
      }
      context.addSchema("", schema);
      let error = context.validateAll(data, schema, null, null, "");
      if (!error && banUnknownProperties) {
        error = context.banUnknownProperties();
      }
      this.error = error;
      this.missing = context.missing;
      this.valid = (error === null);
      return this.valid;
    },
    validateResult: () => {
      let result = {};
      this.validate.apply(result, arguments);
      return result;
    },
    validateMultiple: (data, schema, checkRecursive, banUnknownProperties) => {
      const context = new ValidatorContext(_myContext, true, languages[currentLanguage], checkRecursive, banUnknownProperties);
      if (typeof schema === "string") {
        schema = {"$ref": schema};
      }
      context.addSchema("", schema);
      context.validateAll(data, schema, null, null, "");
      if (banUnknownProperties) {
        context.banUnknownProperties();
      }
      let result = {};
      result.errors = context.errors;
      result.missing = context.missing;
      result.valid = (result.errors.length === 0);
      return result;
    },
    addSchema: (url, schema) => {
      return _myContext.addSchema(url, schema);
    },
    getSchema: (url, urlHistory) => {
      return _myContext.getSchema(url, urlHistory);
    },
    getSchemaMap: () => {
      return _myContext.getSchemaMap.apply(_myContext, arguments);
    },
    getSchemaUris: () => {
      return _myContext.getSchemaUris.apply(_myContext, arguments);
    },
    getMissingUris: () => {
      return _myContext.getMissingUris.apply(_myContext, arguments);
    },
    dropSchemas: () => {
      _myContext.dropSchemas.apply(_myContext, arguments);
    },
    defineKeyword: () => {
      _myContext.defineKeyword.apply(_myContext, arguments);
    },
    defineError: (codeName, codeNumber, defaultMessage) => {
      if (typeof codeName !== 'string' || !/^[A-Z]+(_[A-Z]+)*$/.test(codeName)) {
        // TODO message bundle this
        throw new Error('Code name must be a string in UPPER_CASE_WITH_UNDERSCORES');
      }
      if (typeof codeNumber !== 'number' || codeNumber%1 !== 0 || codeNumber < 10000) {
        // TODO message bundle this
        throw new Error('Code number must be an integer > 10000');
      }
      if (typeof ERROR_CODES[codeName] !== 'undefined') {
        // TODO message bundle this
        throw new Error('Error already defined: ' + codeName + ' as ' + ERROR_CODES[codeName]);
      }
      if (typeof ErrorCodeLookup[codeNumber] !== 'undefined') {
        // TODO message bundle this
        throw new Error('Error code already used: ' + ErrorCodeLookup[codeNumber] + ' as ' + codeNumber);
      }
      ERROR_CODES[codeName] = codeNumber;
      ErrorCodeLookup[codeNumber] = codeName;
      ERROR_MESSAGES_DEFAULT[codeName] = ERROR_MESSAGES_DEFAULT[codeNumber] = defaultMessage;
      for (let langCode in languages) {
        let language = languages[langCode];
        if (language[codeName]) {
          language[codeNumber] = language[codeNumber] || language[codeName];
        }
      }
    },
    reset: () => {
      _myContext.reset();
      this.error = null;
      this.missing = [];
      this.valid = true;
    },
    missing: [],
    error: null,
    valid: true,
    normSchema: normSchema,
    resolveUrl: resolveUrl,
    getDocumentUri: getDocumentUri,
    errorCodes: ERROR_CODES
  };
  return api;
};

export default createApi;
