import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listImages, removeImage } from "../services/api";
import type { Image } from "../services/api";
import "./Images.css";

const Images: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: images } = useQuery<Image[]>({
    queryKey: ["images"],
    queryFn: listImages,
  });
  const removeMutation = useMutation({
    mutationFn: removeImage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["images"] }),
  });

  return (
    <div className="images-page">
      <h2>Images</h2>
      <div className="cards">
        {images?.map((img) => (
          <div key={img.id} className="card image-card">
            <h3>
              {img.repo_tags && img.repo_tags.length > 0
                ? img.repo_tags.join(", ")
                : "<none>:<none>"}
            </h3>
            <p>Size: {(img.size / (1024 * 1024)).toFixed(2)} MB</p>
            <button onClick={() => removeMutation.mutate(img.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Images;
