import { useEffect, useRef, useState } from 'react';
import axios from '../../api/axios';

const getPhotoEndpoint = (source) => {
  if (!source) return '';
  if (/^blob:|^data:/i.test(source)) return source;

  let pathname = source;
  if (/^https?:\/\//i.test(source)) {
    try {
      pathname = new URL(source).pathname;
    } catch {
      return '';
    }
  }

  const fileName = pathname.split('/').filter(Boolean).pop();
  return fileName ? `/uploads/users/${encodeURIComponent(fileName)}` : '';
};

export default function AuthenticatedImage({ src, onError, ...imageProps }) {
  const [imageSource, setImageSource] = useState('');
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const endpoint = getPhotoEndpoint(src);
    if (!endpoint) {
      setImageSource('');
      return undefined;
    }
    if (/^blob:|^data:/i.test(endpoint)) {
      setImageSource(endpoint);
      return undefined;
    }

    let active = true;
    let objectUrl = '';
    axios.get(endpoint, { responseType: 'blob' })
      .then(({ data }) => {
        objectUrl = URL.createObjectURL(data);
        if (active) setImageSource(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) {
          setImageSource('');
          onErrorRef.current?.();
        }
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return imageSource ? <img {...imageProps} src={imageSource} onError={onError} /> : null;
}
