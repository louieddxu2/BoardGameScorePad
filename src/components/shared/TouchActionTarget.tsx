import React from 'react';
import { useTouchAction } from './useTouchAction';

interface TouchActionTargetProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  moveThreshold?: number;
  onActivate: (event: React.SyntheticEvent<HTMLDivElement>) => void;
}

const TouchActionTarget: React.FC<TouchActionTargetProps> = ({
  children,
  className,
  style,
  moveThreshold,
  onActivate,
}) => {
  const touchHandlers = useTouchAction<HTMLDivElement>(onActivate, { moveThreshold });

  return (
    <div {...touchHandlers} className={className} style={style}>
      {children}
    </div>
  );
};

export default TouchActionTarget;
