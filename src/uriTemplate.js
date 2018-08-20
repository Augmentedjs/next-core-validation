import { isFunction } from "next-core-utilities";

class UriTemplate {
  constructor(template) {
    /*f (!(this instanceof UriTemplate)) {
      return new UriTemplate(template);
    }*/
    //this.template = null;
    //this.varNames = null;

    let parts = template.split("{");
    let textParts = [parts.shift()];
    let prefixes = [];
    let substitutions = [];
    let varNames = [];
    while (parts.length > 0) {
      let part = parts.shift();
      let spec = part.split("}")[0];
      let remainder = part.substring(spec.length + 1);
      let funcs = uriTemplateSubstitution(spec);
      substitutions.push(funcs.substitution);
      prefixes.push(funcs.prefix);
      textParts.push(remainder);
      varNames = varNames.concat(funcs.substitution.varNames);
    }
    this.varNames = varNames;
    this.template = template;
  };

  fill(valueFunction) {
    let result = textParts[0];
    let i=0, l = substitutions.length;
    for (i = 0; i < l; i++) {
      let substitution = substitutions[i];
      if (!substitution && !isFunction(substitution)) {
        throw new Error("Problemn filling URI Template.");
      }
      result += substitution(valueFunction);
      result += textParts[i + 1];
    }
    return result;
  };

  toString() {
    return this.template;
  };

  fillFromObject(obj) {
    return this.fill(function (varName) {
      return obj[varName];
    });
  };
};

export default UriTemplate;
