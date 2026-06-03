1. Any user can create a ticket by providing a title, description and due date; the creator is recorded as the ticket's `user_id` and an optional file attachment can be included.

2. When creating a ticket, the creator may set `assigned_to` to assign the ticket; if they do, the ticket's status is set to `Assigned`.

3. Users with the `Management` role, the ticket creator, or the current assignee are allowed to edit most fields; other users may only edit the ticket's title and description.

4. Only `Management` or the ticket creator can change the `due_date`; `Manager` role users are not permitted to change the due date unless they are also the creator.

5. Status changes follow a controlled map: Open → Assigned/Rejected, Assigned → In Progress/Rejected, In Progress → Resolved/Rejected, Resolved → Closed, and Rejected → Open; invalid transitions are rejected.

Modified rules: 
Status changes follow a controlled map: Only these transitions are allowed:`
Open → Rejected
Open -> Closed



6. Only the current assignee may set status to `In Progress`, `Rejected`, or `Resolved`; only the ticket creator may set status to `Closed`.

7. When the creator reassigns a ticket to someone else, the status is forced to `Assigned`.

8. On status changes the system creates notifications: rejected tickets send a special notification to the creator, resolved tickets notify the creator, and reassignment creates an assignment notification for the new assignee.

9. The `Rejected` status is treated as transient: when a ticket is marked `Rejected` the code resets the status back to `Open` and clears `assigned_to` so the creator can reassign.

10. Tickets may only be deleted when their status is `Closed`; otherwise deletion attempts are blocked.

