export function validateSchema(schema) {
  if (!typeof schema === "object") throw new Error(`Schema is not an object`);
  if (Array.isArray(schema)) throw new Error(`Schema is an Array`);

  if (schema.type !== "object") throw new Error(`Schema.type must be "object"`);
  if (!schema.properties) throw new Error(`Schema.properties missing`);

  validateProperties(schema.properties, "");
}
function validateProperties(properties, key) {
  if (key) key += ".";

  for (const [propKey, prop] of Object.entries(properties)) {
    validateProperty(prop, key + propKey);
  }
}
function validateProperty(property, key) {
  if (!property.type) throw new Error(`${key}: Property "type" missing`);

  const typeValues = [
    "boolean",
    "string",
    "number",
    "integer",
    "array",
    "object",
  ]; // not "null"

  let baseType;
  if (typeof property.type === "string") {
    baseType = property.type;
  } else if (Array.isArray(property.type)) {
    if (property.type.length === 1) {
      // nothing
    } else if (property.type.length === 2) {
      if (property.type[1] !== "null")
        throw new Error(
          `${key}: Second element of property "type" must be "null"`
        );
    } else
      throw new Error(
        `${key}: Property "type" must be an array of length 1 or 2`
      );
    baseType = property.type[0];
  } else
    throw new Error(`${key}: Property "type" must be a string or an array`);

  if (!typeValues.includes(baseType))
    throw new Error(
      `${key}: First element of property "type" has value "${
        property.type[0]
      }", which is not one of the valid ones (${typeValues.join(", ")})`
    );

  if (property.gddType) {
    if (typeof property.gddType !== 'string')
      throw new Error(`${key}: Property "gddType" must be a string`);
  }
}
