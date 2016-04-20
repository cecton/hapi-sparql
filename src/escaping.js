export function escapeString (value) {
  return (
    '"' + value
      .replace(/[\\"]/g, '\\$&')
      .replace('\x0a', '\\n')
      .replace('\x0d', '\\r') +
    '"'
  )
}

export function escapeDate (value) {
  return `"${value.toISOString()}"^^xsd:dateTime`
}

export function escapeBoolean (value) {
  return value ? 'true' : 'false'
}
