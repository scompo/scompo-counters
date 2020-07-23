package main

import (
	"fmt"
	"sync"
)

// Userdb is an in memory user storage.
type Userdb struct {
	users map[string]*User
	mu    sync.RWMutex
}

var db *Userdb

// DB returns a userdb singleton instance.
func DB() *Userdb {
	if db == nil {
		db = &Userdb{
			users: make(map[string]*User),
		}
	}
	return db
}

// GetUser returns a *User by the user's name.
func (db *Userdb) GetUser(name string) (*User, error) {
	db.mu.Lock()
	defer db.mu.Unlock()
	user, ok := db.users[name]
	if !ok {
		return &User{}, fmt.Errorf("user not found by username '%s'", name)
	}
	return user, nil
}

// PutUser stores a new *User in the db.
func (db *Userdb) PutUser(user *User) {
	db.mu.Lock()
	defer db.mu.Unlock()
	db.users[user.name] = user
}
