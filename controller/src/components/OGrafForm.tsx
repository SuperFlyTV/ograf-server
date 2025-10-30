import * as React from "react";
import { getDefaultDataFromSchema, SuperFlyTvOgrafDataForm } from "ograf-form";
import { toJS } from "mobx";

interface HTMLOgrafFormElement extends HTMLElement {}
interface OgrafFormAttributes<T> extends React.HTMLAttributes<T> {
  schema?: unknown;
  value?: unknown;
  formStyle?: string;
  dictionary?: {};
  getGDDElement?: () => any;
  postRender?: () => any;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "superflytv-ograf-form": React.DetailedHTMLProps<
        OgrafFormAttributes<HTMLOgrafFormElement>,
        HTMLOgrafFormElement
      >;
    }
  }

  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        ["superflytv-ograf-form"]: React.DetailedHTMLProps<
          OgrafFormAttributes<HTMLOgrafFormElement>,
          HTMLOgrafFormElement
        >;
      }
    }
  }
}

export function OGrafForm({
  schema,
  initialValue,
  value,
  onDataChangeCallback,
}: {
  schema: unknown;
  initialValue?: unknown;
  value?: unknown;
  onDataChangeCallback;
}) {
  /** Ref to the form component */
  const formRef = React.useRef<HTMLOgrafFormElement>(null);
  /** State to hold the data */
  const [data, setData] = React.useState(() =>
    // Use default data from schema as initial data:
    initialValue ? initialValue : schema ? getDefaultDataFromSchema(schema) : {}
  );

  React.useEffect(() => {
    // Initial callback with data

    onDataChangeCallback(data);
  }, []);

  React.useEffect(() => {
    if (value !== undefined) setData(value);
  }, [value]);

  /** Callback when the data changes */
  const onDataChange = React.useCallback((newData) => {
    setData(newData);
    onDataChangeCallback(newData);
  }, []);

  // Set up listener for when the data has changed in the form:
  React.useLayoutEffect(() => {
    if (formRef.current) {
      const listener = (e) => {
        if (e.target !== formRef.current) return;
        onDataChange(e.target.value);
      };
      const el = formRef.current;
      el.addEventListener("change", listener);
      return () => el.removeEventListener("change", listener);
    }
  });
  // (Optional) Set up listener for whenever user is editing (ie every key)
  // React.useLayoutEffect(() => {
  //   if (formRef.current) {
  //     const listener = (e) => onDataChange(e.target.value);
  //     formRef.current.addEventListener("keyup", listener);
  //     return () => formRef.current.removeEventListener("keyup", listener);
  //   }
  // });

  if (!schema) {
    return <div>No schema.</div>;
  }

  return (
    <div>
      <superflytv-ograf-form
        ref={formRef}
        schema={schema}
        value={data}
      ></superflytv-ograf-form>
    </div>
  );
}
