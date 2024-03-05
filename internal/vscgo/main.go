// Copyright 2023 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// The package vscgo is an implementation of
// github.com/golang/vscode-go/vscgo. This is in
// a separate internal package, so
// github.com/golang/vscode-go/extension can import.
package vscgo

import (
	"flag"
	"fmt"
	"log"
	"os"
	"runtime/debug"
	"strings"
)

type command struct {
	usage   string
	short   string
	flags   *flag.FlagSet
	hasArgs bool
	run     func(args []string) error
}

func (c command) name() string {
	name, _, _ := strings.Cut(c.usage, " ")
	return name
}

var allCommands []*command

func init() {
	allCommands = []*command{
		{
			usage: "version",
			short: "print version information",
			run:   runVersion,
		},
		{
			usage:   "help <command>",
			short:   "show help for a command",
			hasArgs: true,
			run:     runHelp, // accesses allCommands.
		},
	}

	for _, cmd := range allCommands {
		name := cmd.name()
		if cmd.flags == nil {
			cmd.flags = flag.NewFlagSet(name, flag.ExitOnError)
		}
		cmd.flags.Usage = func() {
			help(name)
		}
	}
}

func Main() {
	log.SetFlags(0)
	flag.Usage = usage
	flag.Parse()

	args := flag.Args()
	var cmd *command
	if len(args) > 0 {
		cmd = findCommand(args[0])
	}
	if cmd == nil {
		flag.Usage()
		os.Exit(2)
	}
	cmd.flags.Parse(args[1:]) // will exit on error
	args = cmd.flags.Args()
	if !cmd.hasArgs && len(args) > 0 {
		help(cmd.name())
		failf("\ncommand %q does not accept any arguments.\n", cmd.name())
	}
	if err := cmd.run(args); err != nil {
		failf("%v\n", err)
	}
}

func output(msgs ...interface{}) {
	fmt.Fprintln(flag.CommandLine.Output(), msgs...)
}

func usage() {
	printCommand := func(cmd *command) {
		output(fmt.Sprintf("\t%s\t%s", cmd.name(), cmd.short))
	}
	output("vscgo is a helper tool for the VS Code Go extension, written in Go.")
	output()
	output("Usage:")
	output()
	output("\tvscgo <command> [arguments]")
	output()
	output("The commands are:")
	output()
	for _, cmd := range allCommands {
		printCommand(cmd)
	}
	output()
	output(`Use "vscgo help <command>" for details about any command.`)
	output()
}

func failf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format, args...)
	os.Exit(1)
}

func findCommand(name string) *command {
	for _, cmd := range allCommands {
		if cmd.name() == name {
			return cmd
		}
	}
	return nil
}

func help(name string) {
	cmd := findCommand(name)
	if cmd == nil {
		failf("unknown command %q\n", name)
	}
	output(fmt.Sprintf("Usage: vscgo %s", cmd.usage))
	output()
	output(fmt.Sprintf("%s is used to %s.", cmd.name(), cmd.short))
	anyflags := false
	cmd.flags.VisitAll(func(*flag.Flag) {
		anyflags = true
	})
	if anyflags {
		output()
		output("Flags:")
		output()
		cmd.flags.PrintDefaults()
	}
}

func runVersion(_ []string) error {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		fmt.Println("vscgo: unknown")
		fmt.Println("go: unknown")
		return nil
	}
	fmt.Println("vscgo:", info.Main.Version)
	fmt.Println("go:", info.GoVersion)
	return nil
}

func runHelp(args []string) error {
	switch len(args) {
	case 1:
		help(args[0])
	default:
		flag.Usage()
		failf("too many arguments to \"help\"")
	}
	return nil
}
