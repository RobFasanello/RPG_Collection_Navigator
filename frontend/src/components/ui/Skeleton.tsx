import * as React from 'react';

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

function Skeleton({ className = '', ...props }: SkeletonProps) {
  return <div className={`animate-pulse rounded-md bg-slate-200 ${className}`.trim()} {...props} />;
}

export { Skeleton };