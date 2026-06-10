import NextLink from 'next/link'
import type { ComponentProps } from 'react'

type LinkProps = ComponentProps<typeof NextLink>

export default function NoPrefetchLink({ prefetch = false, ...props }: LinkProps) {
  return <NextLink prefetch={prefetch} {...props} />
}
