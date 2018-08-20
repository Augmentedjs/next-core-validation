/**
 * @see https://github.com/geraintluff/uri-templates
 * but with all the de-substitution stuff removed
 */
export const URI_TEMPLATE_GLOBAL_MODIFIERS = {
  "+": true,
  "#": true,
  ".": true,
  "/": true,
  ";": true,
  "?": true,
  "&": true
};

export const URI_TEMPLATE_SUFFICES = {
  "*": true
};

// parseURI() and resolveUrl() are from https://gist.github.com/1088850
// - released as public domain by author ("Yaffle") - see comments on
// gist
export const parseURI = (url) => {
  const m = String(url).replace(/^\s+|\s+$/g, '').match(/^([^:\/?#]+:)?(\/\/(?:[^:@]*(?::[^:@]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
  // authority = '//' + user + ':' + pass '@' + hostname + ':' port
  return (m ? {
    href     : m[0] || '',
    protocol : m[1] || '',
    authority: m[2] || '',
    host     : m[3] || '',
    hostname : m[4] || '',
    port     : m[5] || '',
    pathname : m[6] || '',
    search   : m[7] || '',
    hash     : m[8] || ''
  } : null);
};

export const removeDotSegments = (input) => {
  let output = [];
  input.replace(/^(\.\.?(\/|$))+/, '')
       .replace(/\/(\.(\/|$))+/g, '/')
       .replace(/\/\.\.$/, '/../')
       .replace(/\/?[^\/]*/g, function (p) {
    if (p === '/..') {
      output.pop();
    } else {
      output.push(p);
    }
  });
  return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
};

export const resolveUrl = (base, href) => {// RFC 3986
  href = parseURI(href || '');
  base = parseURI(base || '');

  return !href || !base ? null : (href.protocol || base.protocol) +
  (href.protocol || href.authority ? href.authority : base.authority) +
  removeDotSegments(href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname : (href.pathname ? ((base.authority && !base.pathname ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname) : base.pathname)) +
  (href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
  href.hash;
};

export const getDocumentUri = (uri) => {
  return uri.split('#')[0];
};

export const isTrustedUrl = (baseUrl, testUrl) => {
  if(testUrl.substring(0, baseUrl.length) === baseUrl){
    let remainder = testUrl.substring(baseUrl.length);
    if ((testUrl.length > 0 && testUrl.charAt(baseUrl.length - 1) === "/") || remainder.charAt(0) === "#" || remainder.charAt(0) === "?") {
      return true;
    }
  }
  return false;
};

export const normSchema = (schema, baseUri) => {
  if (schema && typeof schema === "object") {
    if (baseUri === undefined) {
      baseUri = schema.id;
    } else if (typeof schema.id === "string") {
      baseUri = resolveUrl(baseUri, schema.id);
      schema.id = baseUri;
    }
    if (Array.isArray(schema)) {
      let i = 0, l = schema.length;
      for (i = 0; i < l; i++) {
        normSchema(schema[i], baseUri);
      }
    } else {
      if (typeof schema['$ref'] === "string") {
        schema['$ref'] = resolveUrl(baseUri, schema['$ref']);
      }
      for (let key in schema) {
        if (key !== "enum") {
          normSchema(schema[key], baseUri);
        }
      }
    }
  }
};
