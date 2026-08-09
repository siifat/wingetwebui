# User Roles & Permissions

## 1. Overview

WingetWebUI is designed primarily as a user-facing web application for discovering WinGet packages, creating application configurations, and generating installation commands and scripts.

Based on the current project scope and requirements, the MVP requires **only one user role: User**.

The MVP does not require user accounts, authentication, authorization, or an administrative dashboard.

---

## 2. User Role

### Role Name

**User**

### Description

A User is any person who accesses WingetWebUI to discover Windows applications, create an application selection, customize installation options, generate WinGet commands or installation scripts, and manage application configurations.

The User role covers the project's primary target audiences:

- Regular Windows users
- Developers and technical users

A User does not need to create an account or authenticate to use the core functionality of WingetWebUI.

---

## 3. User Permissions

| Permission                 | Description                                                   |
| -------------------------- | ------------------------------------------------------------- |
| View Packages              | View available WinGet packages                                |
| View Categories            | Browse packages by category                                   |
| Search Packages            | Search for packages                                           |
| Search Categories          | Search for categories                                         |
| Fuzzy Search               | Find packages and categories using approximate search terms   |
| View Package Details       | View available package information                            |
| Select Packages            | Select individual packages                                    |
| Multi-Select Packages      | Select multiple packages using Ctrl-based selection           |
| Range-Select Packages      | Select a range of packages using Shift-based selection        |
| Select Category            | Select all packages within a category                         |
| Deselect Category          | Deselect all packages within a category                       |
| Remove Package             | Remove an individual package from the current selection       |
| Clear Selection            | Remove all currently selected packages                        |
| View Selection Count       | View the number of currently selected packages                |
| Reorder Packages           | Reorder selected packages using drag-and-drop                 |
| Customize WinGet Options   | Enable or disable supported WinGet command options            |
| Generate WinGet Command    | Generate a command based on the selected packages and options |
| Copy WinGet Command        | Copy the generated command to the clipboard                   |
| Generate PowerShell Script | Generate a `.ps1` installation script                         |
| Generate Batch Script      | Generate a `.bat` installation script                         |
| Preview Scripts            | Preview generated installation scripts                        |
| Download PowerShell Script | Download the generated `.ps1` script                          |
| Download Batch Script      | Download the generated `.bat` script                          |
| Save Configuration         | Save the current application configuration                    |
| Export Configuration       | Export a reusable configuration file                          |
| Import Configuration       | Import a previously exported configuration                    |
| Reset Configuration        | Reset the current configuration                               |
| Switch Display Mode        | Switch between Card View and List View                        |

---

## 4. User Restrictions

The User does not have permissions to:

- Modify the application's underlying package data.
- Modify system-wide package categories.
- Modify application-level configuration.
- Manage other users.
- Access administrative functionality.
- Modify the WingetWebUI application itself.

These restrictions are primarily conceptual for the MVP because no authentication or role-based authorization system is required.

---

## 5. Authentication Requirements

Authentication is **not required for the MVP**.

Users shall be able to access and use the core functionality of WingetWebUI without:

- Creating an account
- Logging in
- Providing personal information
- Managing a password

The application should therefore support the primary workflow immediately upon opening the website.

---

## 6. Configuration Ownership

In the MVP, configurations are treated as user-created artifacts rather than account-owned server-side data.

Users shall be able to:

1. Create a package configuration.
2. Modify the configuration.
3. Export the configuration.
4. Import the configuration later.
5. Reuse the configuration on another compatible session or device.

Persistent cloud-based configuration storage associated with user accounts is outside the current MVP scope.

---

## 7. Administrative Roles

### MVP Status

**No administrative role is required for the MVP.**

WingetWebUI should not introduce an Administrator role solely for the purpose of managing WinGet packages if package information is obtained dynamically from the underlying package ecosystem or an external package source.

This avoids unnecessary:

- Authentication infrastructure
- Authorization logic
- Admin dashboards
- User management
- Administrative database operations
- Additional security complexity

### Future Consideration

An Administrator or Maintainer role may be introduced in a future version if the system eventually requires application-managed data or functionality such as:

- Maintaining a locally managed package catalog
- Managing custom categories
- Managing package metadata
- Managing user-submitted packages
- Managing application-wide settings
- Monitoring application health

Such functionality shall require new requirements before an administrative role is implemented.

---

## 8. MVP Role Summary

| Role          | MVP Status   | Authentication | Primary Responsibility                                                               |
| ------------- | ------------ | -------------- | ------------------------------------------------------------------------------------ |
| User          | Required     | Not required   | Discover packages, create configurations, and generate installation commands/scripts |
| Administrator | Not included | Not applicable | Future administrative functionality, if required                                     |

---

## 9. Role Design Principle

The MVP shall follow a **minimal-role principle**:

> Only introduce user roles and permissions that are required by the project's actual functionality.

The current version of WingetWebUI therefore treats the application as a primarily public, user-facing tool rather than an account-based platform.
