package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"os"
)

type fixture struct {
	Subject string
	Body    string
	Data    map[string]string
}

func main() {
	var fixtures []fixture
	if err := json.NewDecoder(os.Stdin).Decode(&fixtures); err != nil {
		panic(err)
	}
	results := make([]map[string]string, 0, len(fixtures))
	for _, fixture := range fixtures {
		result := map[string]string{}
		for name, source := range map[string]string{"subject": fixture.Subject, "body": fixture.Body} {
			// Supabase's template mailer parses both fields with html/template,
			// without a custom FuncMap. Exercise that exact standard API here.
			tpl, err := template.New(name).Parse(source)
			if err != nil {
				panic(fmt.Errorf("%s parse: %w", name, err))
			}
			var output bytes.Buffer
			if err := tpl.Execute(&output, fixture.Data); err != nil {
				panic(fmt.Errorf("%s execute: %w", name, err))
			}
			result[name] = output.String()
		}
		results = append(results, result)
	}
	if err := json.NewEncoder(os.Stdout).Encode(results); err != nil {
		panic(err)
	}
}
