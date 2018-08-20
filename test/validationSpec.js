const TEST_SCHEMA = {
	"$schema": "http://json-schema.org/draft-04/schema#",
  "description": "schema for a story",
  "type": "object",
  "title": "Story",
  "properties": {
    "identifier": {
      "type": "string"
    },
    "type": {
      "type": "string",
      "enum": ["Story", "Epic"]
    },
    "title": {
      "type": "string"
    },
    "description": {
      "type": "string",
      "minLength": 0,
      "maxLength": 512
    },
    "estimate": {
      "type": "string",
      "enum": ["1", "2", "3", "5", "8", "13", "20", "40", "100"]
    },
    "assignee": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": ["Planned", "In Progress", "Done"]
    },
    "theme": {
      "type": "string"
    }
  },
  "required": ["title", "type"]
};

describe("Given Validation", () => {
	describe("Given the Augmented Validation Framework", () => {
		let v;
	  beforeEach(() => {
	    v = new Validation.ValidationFramework();
	  });
	  afterEach(() => {
	    v = null;
	  });

		it("is defined", () => {
			expect(Validation.ValidationFramework).to.not.be.undefined;
		});

		it("can create an instance", () => {
			expect(v).to.not.be.undefined;
		});

		it("can register a schema", () => {
			v.registerSchema("story", TEST_SCHEMA);
			const x = v.getSchema("story");
			expect(x).to.not.be.undefined;
		});

		it("can get a schema", () => {
			v.registerSchema("story", TEST_SCHEMA);
			const x = v.getSchema("story");
			expect(x).to.equal(TEST_SCHEMA);
		});

		it("can get a schema map", () => {
			v.registerSchema("story", TEST_SCHEMA);
			const x = v.getSchemas();
			expect(x).to.not.equal({});
		});

		it("can clear a schema", () => {
			v.registerSchema("story", TEST_SCHEMA);
			v.clearSchemas();
			const x = v.getSchemas();
			expect(x["story"]).to.be.undefined;
		});

		it("can validate from a schema", () => {
			v.registerSchema("story", TEST_SCHEMA);
			const result = v.validate({ "x": "x" }, TEST_SCHEMA);
			expect(result).to.not.equal({});
		});

		it("can validate from a schema with errors", () => {
			v.registerSchema("story", TEST_SCHEMA);
			const result = v.validate({ "x": "x" }, TEST_SCHEMA);
			expect(result.errors).to.not.equal({});
		});

		it("can validate from a schema with errors and get messages", () => {
			v.registerSchema("story", TEST_SCHEMA);
			const result = v.validate({ "x": "x" }, TEST_SCHEMA);
			const messages = v.getValidationMessages();
			expect(messages).to.not.equal({});
		});

		it("can validate from a schema with no errors", () => {
			v.registerSchema("story", TEST_SCHEMA);
			const result = v.validate({ "title": "x", "type": "Story" }, TEST_SCHEMA);
			expect(result.errors).to.not.equal({});
		});

		it("can generate a schema", () => {
			const result = v.generateSchema({ "title": "x", "type": "Story" });
			expect(result["$schema"]).to.equal("http://json-schema.org/draft-04/schema#");
		});
	});
});
