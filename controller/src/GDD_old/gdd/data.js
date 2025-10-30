import { Validator } from "jsonschema";

/**
 * Validates the data compared to the schema
 * @param {*} GDDSchema
 * @param {*} data
 * @returns null if all OK, error string otherwise
 */
export function validateData(GDDSchema, data) {
  const v = new Validator();

  const result = v.validate(data, GDDSchema);
  if (result.errors.length > 0) {
    return result.errors.join("\n");
  }

  // TODO: Here we should add GDD-specific checks as well

  return null;
}
export function getDefaultDataFromSchema(GDDSchema, prefilledData, key) {
  // Note: this function assumes that the schema provided has been validated by validateSchema()

  if (GDDSchema.type === "object") {
    const dataObject = clone(prefilledData ?? GDDSchema.default ?? {});
    for (const [subKey, subSchema] of Object.entries(GDDSchema.properties)) {
      const subData = getDefaultDataFromSchema(
        subSchema,
        dataObject[subKey],
        key + "." + subKey
      );
      if (subData !== undefined) dataObject[subKey] = subData;
    }
    return dataObject;
  } else if (GDDSchema.type === "array") {
    const dataArray = clone(prefilledData ?? GDDSchema.default ?? []);
    for (let index = 0; index < dataArray.length; index++) {
      dataArray[index] = getDefaultDataFromSchema(
        GDDSchema.items,
        dataArray[index],
        key + `[${index}]`
      );
    }
    return dataArray;
  } else {
    const data = prefilledData ?? GDDSchema.default ?? undefined;
    if (data !== undefined) return data;

    // Fallback to default values:
    if (GDDSchema.type === "boolean") return false;
    if (GDDSchema.type === "string") return "";
    if (GDDSchema.type === "number") return 0;
    if (GDDSchema.type === "integer") return 0;
  }
}
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
