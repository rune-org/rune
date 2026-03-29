import type { ImgHTMLAttributes } from "react";

type NextImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
  priority?: boolean;
  src: string;
  alt: string;
};

export default function NextImage({ alt, src, ...props }: NextImageProps) {
  return <img alt={alt} src={src} {...props} />;
}
