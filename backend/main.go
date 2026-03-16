package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

func main() {
	// Endpoint API utama
	http.HandleFunc("/api/hello", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Halo dari Backend Divisi Sanditel! 🚀",
			"status":  "success",
		})
	})

	// Endpoint Healthcheck (Wajib buat livenessProbe K8s)
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, "OK")
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Println("Backend Sanditel jalan di port", port)
	http.ListenAndServe(":"+port, nil)
}
