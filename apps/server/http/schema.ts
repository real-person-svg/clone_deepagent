export const idParams = {
  type: 'object',
  properties: { id: { type: 'string', minLength: 1, maxLength: 200 } },
  required: ['id'],
  additionalProperties: false,
};

export const text = (maxLength = 16000) => ({ type: 'string', minLength: 1, maxLength });

export const body = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

export const getId = (params: unknown) => (params as { id: string }).id;
