import SchemaGenerator from "./schemaGenerator.js";
import createApi from "./api.js";
import { ERROR_MESSAGES_DEFAULT } from "./validationError.js";

/**
 * Augmented.ValidationFramework -
 * The Validation Framework Base Wrapper Class.
 * Provides abstraction for base validation build-in library
 */
class ValidationFramework {
  constructor() {
    this._myValidator = createApi();
    if (this._myValidator) {
      this._myValidator.addLanguage("en-us", ERROR_MESSAGES_DEFAULT);  // changed to US
    }
  };

  /**
   * Returns if the framework supports validation
   * @returns {boolean} Returns true if the framework supports validation
   */
  supportsValidation() {
    return (this._myValidator !== null);
  };

  /**
   * Registers a schema to the Framework
   * @param {string} identity The identity of the schema
   * @param {object} schema The JSON schema
   * @returns {boolean} Returns true on success
   */
  registerSchema(identity, schema) {
    return this._myValidator.addSchema(identity, schema);
  };

  /**
   * Gets a schema
   * @param {string} identity The identity of the schema
   * @returns {object} The JSON schema
   */
  getSchema(identity) {
    return this._myValidator.getSchema(identity);
  };

  /**
   * Gets all schemas
   * @returns {array} all JSON schemas
   */
  getSchemas() {
    return this._myValidator.getSchemaMap();
  };

  /**
   * Clears all schemas
   */
  clearSchemas() {
    this._myValidator.dropSchemas();
  };

  /**
   * Validates data via a schema
   * @param {object} data The data to validate
   * @param {object} schema The JSON schema
   * @returns {object} Returns the validation object
   */
  validate(data, schema) {
    return this._myValidator.validateMultiple(data, schema);
  };

  /**
   * Validates data via a schema
   * @returns {array} Returns the validation messages
   */
  getValidationMessages() {
    return this._myValidator.error;
  };

  /**
   * Validates data via a schema
   * @param {Augmented.Model|object} model The model generate from
   * @returns {object} Returns the schema
   */
  generateSchema(model) {
    let data = model;
    /*TODO support model
    if (model && model instanceof Model) {
      data = model.toJSON();
    }*/
    return SchemaGenerator(data);
  };
};

export default ValidationFramework;
