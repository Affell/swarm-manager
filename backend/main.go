package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/Affell/swarm-manager/backend/pkg/infra"
	"github.com/Affell/swarm-manager/backend/pkg/transport"
)

// CustomRecoverConfig définit la configuration pour le middleware de récupération personnalisé
type CustomRecoverConfig struct {
	// StackSize est le nombre maximum d'entrées de pile à récupérer
	StackSize int
	// DisableStackAll désactive la récupération de la pile de tous les goroutines
	DisableStackAll bool
	// DisablePrintStack désactive l'impression de la pile de trace
	DisablePrintStack bool
}

func main() {

	debug := flag.Bool("debug", false, "Enable debug mode")
	flag.Parse()

	// Initialize Docker client
	dockerClient, err := infra.NewDockerClient()
	if err != nil {
		log.Fatalf("failed to create docker client: %v", err)
	}

	// Start Echo
	e := echo.New()
	e.HideBanner = true

	// Middleware de récupération de panique amélioré
	e.Use(customRecover())

	allowedOrigins := []string{"https://swarm.sys.affell.fr"}
	if *debug {
		// En mode debug, autoriser toutes les origines pour faciliter le développement
		allowedOrigins = []string{"*"}
	}

	// CORS middleware avec support WebSocket
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: allowedOrigins,
		AllowMethods: []string{echo.GET, echo.POST, echo.PUT, echo.DELETE, echo.OPTIONS},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization, "Upgrade", "Connection", "Sec-WebSocket-Key", "Sec-WebSocket-Version", "Sec-WebSocket-Protocol"},
	}))

	// Middleware pour gérer les headers de reverse proxy (pour WSS)
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Headers pour les WebSockets derrière un reverse proxy
			if c.Request().Header.Get("X-Forwarded-Proto") == "https" {
				c.Request().Header.Set("X-Forwarded-Ssl", "on")
			}
			return next(c)
		}
	})

	// Structured request logging
	e.Use(middleware.LoggerWithConfig(middleware.LoggerConfig{
		Format: "[${time_rfc3339}] ${method} ${uri} ${status} ${latency_human}\n",
	}))

	// Global HTTP error handler: log and return structured JSON
	e.HTTPErrorHandler = func(err error, c echo.Context) {
		// Determine status code
		code := http.StatusInternalServerError
		msg := err.Error()
		if he, ok := err.(*echo.HTTPError); ok {
			code = he.Code
			if m, ok2 := he.Message.(string); ok2 {
				msg = m
			}
		}
		// Log error with request details
		c.Logger().Errorf("Request %s %s -> error: %s", c.Request().Method, c.Request().URL, msg)
		// Send JSON error response
		if !c.Response().Committed {
			c.JSON(code, map[string]string{"error": msg})
		}
	}

	// Handlers
	h := transport.NewHandler(dockerClient)

	// Routes
	g := e.Group("/api")
	g.GET("/nodes", h.ListNodes)
	g.GET("/nodes/:id/services", h.GetNodeServices)
	g.GET("/stacks", h.ListStacks)
	g.GET("/stacks/:name", h.GetStack)
	g.POST("/stacks/:name/stop", h.StopStack)
	g.POST("/stacks/:name/start", h.StartStack)
	g.GET("/images", h.ListImages)
	g.POST("/images/:id/remove", h.RemoveImage)
	g.POST("/services/:id/stop", h.StopService)
	g.POST("/services/:id/restart", h.RestartService)
	g.GET("/services/:id", h.GetService)
	g.GET("/services/:id/logs", h.ServiceLogs)
	g.GET("/swarm/logs", h.SwarmLogs) // Endpoint WebSocket pour les logs globaux du swarm
	g.POST("/nodes/:id/drain", h.DrainNode)
	g.POST("/nodes/:id/activate", h.ActivateNode)
	g.GET("/version", h.GetVersion)

	// Nouvelles routes pour les fonctionnalités de prune
	g.POST("/prune/images", h.PruneImages)
	g.POST("/prune/containers", h.PruneContainers)
	g.POST("/prune/volumes", h.PruneVolumes)
	g.POST("/prune/networks", h.PruneNetworks)
	g.POST("/prune/system", h.PruneSystem)

	// Routes pour les estimations de cleanup et informations système
	g.GET("/cleanup/estimate", h.GetCleanupEstimate)
	g.GET("/system/info", h.GetSystemInfo)

	// Configuration améliorée pour servir une application React/Vite

	e.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		Skipper: nil,
		// Root directory from where the static content is served.
		Root: "static",
		// Index file for serving a directory.
		// Optional. Default value "index.html".
		Index: "index.html",
		// Enable HTML5 mode by forwarding all not-found requests to root so that
		// SPA (single-page application) can handle the routing.
		HTML5:      true,
		Browse:     false,
		IgnoreBase: false,
		Filesystem: nil,
	}))

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "5000"
	}
	e.Logger.Fatal(e.Start("0.0.0.0:" + port))
}

// customRecover retourne un middleware qui récupère les paniques avec un format de log amélioré
func customRecover() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			defer func() {
				if r := recover(); r != nil {
					err, ok := r.(error)
					if !ok {
						err = fmt.Errorf("%v", r)
					}

					// Formater la stack trace de manière lisible
					stack := make([]byte, 4096)
					length := runtime.Stack(stack, false)

					// Formater la stack trace pour la rendre plus lisible
					stackStr := string(stack[:length])
					formattedStack := formatStackTrace(stackStr)

					timestamp := time.Now().Format(time.RFC3339)
					method := c.Request().Method
					path := c.Request().URL.Path

					// Log formaté avec des informations claires et une mise en forme améliorée
					message := fmt.Sprintf(
						"\n----------------------------------\n"+
							"⚠️  PANIC RECOVERED AT %s\n"+
							"----------------------------------\n"+
							"Route: %s %s\n"+
							"Error: %v\n"+
							"----------------------------------\n"+
							"Stack Trace:\n%s\n"+
							"----------------------------------\n",
						timestamp, method, path, err, formattedStack)

					c.Logger().Error(message)

					// Renvoyer une erreur HTTP 500
					c.Error(echo.NewHTTPError(http.StatusInternalServerError, "Internal Server Error"))
				}
			}()
			return next(c)
		}
	}
}

// formatStackTrace améliore la lisibilité de la stack trace
func formatStackTrace(stackTrace string) string {
	lines := strings.Split(stackTrace, "\n")
	var formattedLines []string

	for i, line := range lines {
		// Ignorer les lignes vides
		if strings.TrimSpace(line) == "" {
			continue
		}

		// Ajouter des indentations et formatage pour les lignes de la stack
		if i > 0 && strings.HasPrefix(line, "\t") {
			// Ligne de code avec fichier et numéro de ligne
			formattedLines = append(formattedLines, "  → "+strings.TrimPrefix(line, "\t"))
		} else {
			// Ligne avec nom de fonction (goroutine ou fonction)
			formattedLines = append(formattedLines, line)
		}
	}

	return strings.Join(formattedLines, "\n")
}
