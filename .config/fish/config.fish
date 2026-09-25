if status is-interactive
    # Commands to run in interactive sessions can go here
end

# Force Wayland backends
set -gx XDG_CURRENT_DESKTOP sway
set -gx XDG_SESSION_DESKTOP sway
set -gx XDG_SESSION_TYPE wayland
set -gx MOZ_ENABLE_WAYLAND 1
set -gx GDK_BACKEND "wayland,x11"
set -gx QT_QPA_PLATFORM "wayland;xcb"
