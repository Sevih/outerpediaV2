type JsonLdValue = string | number | boolean | null | JsonLdNode | JsonLdValue[];
type JsonLdNode = { [key: string]: JsonLdValue };

/**
 * Renders a JSON-LD <script> tag. Escapes `<` to prevent breaking out of the
 * script context if user-controlled data is ever stringified into the payload.
 */
export default function JsonLd({ data, id }: { data: JsonLdNode; id?: string }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      {...(id && { id })}
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
