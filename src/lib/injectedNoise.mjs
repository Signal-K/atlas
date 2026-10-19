// ASV-114: in-app browsers inject a script that rejects with
// "Object Not Found Matching Id:N, MethodName:update, ParamCount:4". It is not
// Atlas code, but it made up 36 of 37 captured exceptions, burying real ones.

const INJECTED_PATTERN = /Object Not Found Matching Id:\s*\d+,\s*MethodName:\s*\w+/i

export function isInjectedWebviewNoise(event) {
  if (!event || event.event !== '$exception') return false
  const properties = event.properties ?? {}
  const messages = [
    properties.$exception_message,
    ...(Array.isArray(properties.$exception_list) ? properties.$exception_list.map((item) => item?.value) : []),
  ]
  return messages.some((message) => typeof message === 'string' && INJECTED_PATTERN.test(message))
}
