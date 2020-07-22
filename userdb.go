package main

import (
	"fmt"
	"sync"
)

type userdb struct {
	users map[string]*User
	mu    sync.RWMutex
}

var db *userdb

// DB returns a userdb singleton instance.
func DB() *userdb {
	if db == nil {
		db = &userdb{
			users: make(map[string]*User),
		}
	}
	return db
}

// GetUser returns a *User by the user's name.
func (db *userdb) GetUser(name string) (*User, error) {
	db.mu.Lock()
	defer db.mu.Unlock()
	user, ok := db.users[name]
	if !ok {
		return &User{}, fmt.Errorf("user not found by username '%s'", name)
	}
	return user, nil
}

// PutUser stores a new *User in the db.
func (db *userdb) PutUser(user *User) {
	db.mu.Lock()
	defer db.mu.Unlock()
	db.users[user.name] = user
}
